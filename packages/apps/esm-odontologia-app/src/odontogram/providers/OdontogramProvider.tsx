/**
 * OdontogramProvider — Core del nuevo sistema de estado.
 *
 * Cada <OdontogramProvider> crea su propia instancia de estado.
 * Múltiples odontogramas en la misma página NO comparten estado.
 *
 * Patrón: Componente controlado.
 * - `data` viene del padre (leído de BBDD)
 * - `onChange` notifica al padre de cambios (para guardar en BBDD)
 * - Sin `onChange` → modo solo lectura
 *
 * El estado UI efímero (qué hallazgo está seleccionado en el form)
 * vive dentro del Provider y NO se persiste.
 */

import { showSnackbar } from '@openmrs/esm-framework';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  calculateLegendDesign,
  getFixedDesignNumber,
  getPositionBasedDesign,
  isMultiDesignFinding,
  isRowFinding,
  recalculateLegendDesigns,
  recalculateSpacingDesigns,
  recalculateToothDesigns,
  recalculateToothDesignsFromLegendSpaces,
  usesAdjacencyLogic,
  usesPositionLogic,
  usesToothAdjacencyLogic,
} from '../logic/findingDesignLogic';
import type { FormSelectionState, OdontogramContextValue } from '../types/context';
import type {
  FindingColor,
  FindingDesign,
  FindingOptionConfig,
  FindingSuboption,
  LegendSpaceData,
  OdontogramConfig,
  OdontogramData,
  SpaceData,
  SpaceFinding,
  ToothConfig,
  ToothFinding,
  ToothPosition,
} from '../types/odontogram';
import { computeToothAnnotations } from '../utils/computeToothAnnotations';

// =============================================================================
// CONSTANTS
// =============================================================================

const EMPTY_FORM_SELECTION: FormSelectionState = {
  selectedFindingId: null,
  selectedColor: null,
  selectedSuboption: null,
  selectedDesign: null,
  isComplete: false,
};

// =============================================================================
// CONTEXT
// =============================================================================

const OdontogramContext = createContext<OdontogramContextValue | null>(null);

// =============================================================================
// HOOK PÚBLICO
// =============================================================================

/**
 * Hook para acceder al contexto del odontograma desde cualquier sub-componente.
 * Solo funciona dentro de un <OdontogramProvider>.
 */
export function useOdontogramContext(): OdontogramContextValue {
  const ctx = useContext(OdontogramContext);
  if (!ctx) {
    throw new Error(
      'useOdontogramContext must be used within an <OdontogramProvider>. ' +
        'Wrap your <Odontogram> component in an <OdontogramProvider>.',
    );
  }
  return ctx;
}

// =============================================================================
// HELPERS
// =============================================================================

function generateId(): string {
  return crypto.randomUUID();
}

/** Devuelve la posición de un diente dado su ID y la config */
function getToothPosition(toothId: number, config: OdontogramConfig): ToothPosition | null {
  if (config.teeth.upper.some((t) => t.id === toothId)) return 'upper';
  if (config.teeth.lower.some((t) => t.id === toothId)) return 'lower';
  return null;
}

// =============================================================================
// PROVIDER
// =============================================================================

interface OdontogramProviderProps {
  config: OdontogramConfig;
  data: OdontogramData;
  onChange?: (data: OdontogramData) => void;
  readOnly?: boolean;
  children: React.ReactNode;
}

export function OdontogramProvider({
  config,
  data,
  onChange,
  readOnly: readOnlyProp,
  children,
}: OdontogramProviderProps) {
  const readOnly = readOnlyProp ?? !onChange;

  // ---------------------------------------------------------------------------
  // Estado UI efímero — NO se persiste
  // ---------------------------------------------------------------------------
  const [formSelection, setFormSelection] = useState<FormSelectionState>(EMPTY_FORM_SELECTION);

  // ---------------------------------------------------------------------------
  // Toast: delegate to the project-wide Carbon snackbar provided by
  // @openmrs/esm-framework so it follows the same design language as the rest
  // of the workspace (replaces an in-house overlay div previously rendered
  // inside this provider).
  // ---------------------------------------------------------------------------
  const showToast = useCallback((message: string) => {
    showSnackbar({
      title: message,
      kind: 'warning',
      isLowContrast: true,
    });
  }, []);

  // When switching to readOnly, clear form selection so grey overlays disappear
  useEffect(() => {
    if (readOnly) {
      setFormSelection(EMPTY_FORM_SELECTION);
    }
  }, [readOnly]);

  // ---------------------------------------------------------------------------
  // Helpers de consulta (memoizados)
  // ---------------------------------------------------------------------------
  const toothConfigMap = useMemo(() => {
    const map = new Map<number, ToothConfig>();
    for (const t of [...config.teeth.upper, ...config.teeth.lower]) {
      map.set(t.id, t);
    }
    return map;
  }, [config]);

  const findingOptionMap = useMemo(() => {
    const map = new Map<number, FindingOptionConfig>();
    for (const f of config.findingOptions) {
      map.set(f.id, f);
    }
    return map;
  }, [config]);

  const getToothConfig = useCallback((toothId: number) => toothConfigMap.get(toothId), [toothConfigMap]);

  const getTeethByPosition = useCallback((position: ToothPosition) => config.teeth[position], [config]);

  const getFindingOption = useCallback((findingId: number) => findingOptionMap.get(findingId), [findingOptionMap]);

  // ---------------------------------------------------------------------------
  // Emit helper — inmutable, notifica al padre
  // ---------------------------------------------------------------------------
  const emit = useCallback(
    (newData: OdontogramData) => {
      if (onChange) onChange(newData);
    },
    [onChange],
  );

  // ---------------------------------------------------------------------------
  // Form Actions
  // ---------------------------------------------------------------------------
  const selectFinding = useCallback(
    (findingId: number | null) => {
      const option = findingId ? findingOptionMap.get(findingId) : null;
      const hasColors = (option?.colores?.length ?? 0) > 0;
      const hasSuboptions = (option?.subopciones?.length ?? 0) > 0;
      const autoColor = option?.colores?.length === 1 && !hasSuboptions ? option.colores[0] : null;

      // isComplete: true si no hay campos pendientes por llenar
      let autoIsComplete = false;
      if (findingId !== null && option) {
        if (!hasColors && !hasSuboptions) {
          // Sin colores ni subopciones → completo al seleccionar
          autoIsComplete = true;
        } else if (autoColor !== null) {
          // Auto-color (1 solo color, sin subopciones) → completo
          autoIsComplete = true;
        }
      }

      setFormSelection({
        selectedFindingId: findingId,
        selectedColor: autoColor,
        selectedSuboption: null,
        selectedDesign: null,
        isComplete: autoIsComplete,
      });
    },
    [findingOptionMap],
  );

  const selectColor = useCallback(
    (color: FindingColor | null) => {
      setFormSelection((prev) => {
        const option = prev.selectedFindingId ? findingOptionMap.get(prev.selectedFindingId) : null;
        const hasSuboptions = (option?.subopciones?.length ?? 0) > 0;
        const hasColors = (option?.colores?.length ?? 0) > 0;

        const isCompleteNow =
          prev.selectedFindingId !== null &&
          (!hasColors || color !== null) &&
          (!hasSuboptions || prev.selectedSuboption !== null);

        return {
          ...prev,
          selectedColor: color,
          isComplete: isCompleteNow,
        };
      });
    },
    [findingOptionMap],
  );

  const selectSuboption = useCallback(
    (suboption: FindingSuboption | null) => {
      setFormSelection((prev) => {
        const option = prev.selectedFindingId ? findingOptionMap.get(prev.selectedFindingId) : null;
        const hasSuboptions = (option?.subopciones?.length ?? 0) > 0;
        const hasColors = (option?.colores?.length ?? 0) > 0;

        // Autocompletar color si hay 1 solo y no estaba seleccionado
        let autoColor = prev.selectedColor;
        if (!autoColor && option?.colores?.length === 1) {
          autoColor = option.colores[0];
        }

        const isCompleteNow =
          prev.selectedFindingId !== null &&
          (!hasColors || autoColor !== null) &&
          (!hasSuboptions || suboption !== null);

        return {
          ...prev,
          selectedSuboption: suboption,
          selectedColor: autoColor,
          isComplete: isCompleteNow,
        };
      });
    },
    [findingOptionMap],
  );

  const selectDesign = useCallback((design: FindingDesign | null) => {
    setFormSelection((prev) => ({ ...prev, selectedDesign: design }));
  }, []);

  const resetSelection = useCallback(() => {
    setFormSelection({
      selectedFindingId: null,
      selectedColor: null,
      selectedSuboption: null,
      selectedDesign: null,
      isComplete: false,
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Tooth Actions
  // ---------------------------------------------------------------------------
  const registerToothFinding = useCallback(
    (params: {
      toothId: number;
      findingId: number;
      color: FindingColor;
      subOptionId?: number;
      designNumber?: number | null;
    }) => {
      if (readOnly) return;

      const position = getToothPosition(params.toothId, config);
      if (!position) return;

      // Determinar designNumber inicial (se recalculará después si aplica adyacencia)
      let designNumber = params.designNumber ?? null;
      if (designNumber === null) {
        const fixedDesign = getFixedDesignNumber(params.findingId);
        if (fixedDesign !== null) {
          designNumber = fixedDesign;
        } else if (usesPositionLogic(params.findingId)) {
          designNumber = getPositionBasedDesign(position);
        } else {
          designNumber = 1;
        }
      }

      const newFinding: ToothFinding = {
        id: generateId(),
        findingId: params.findingId,
        color: params.color,
        subOptionId: params.subOptionId,
        designNumber,
      };

      // Si es row finding, aplicar a todos los dientes de la misma posición
      const toothIdsToApply = isRowFinding(params.findingId)
        ? config.teeth[position].map((t) => t.id)
        : [params.toothId];

      // For findings with designs: behavior depends on whether multi-design is allowed.
      const hasDesigns = params.designNumber != null && params.designNumber > 0;
      const multiDesign = isMultiDesignFinding(params.findingId);

      let newTeeth = data.teeth.map((tooth) => {
        if (!toothIdsToApply.includes(tooth.toothId)) return tooth;

        if (multiDesign && hasDesigns) {
          // MULTI-DESIGN: each designNumber is independent.
          // Toggle the specific designNumber on/off.
          const exactIndex = tooth.findings.findIndex(
            (f) => f.findingId === params.findingId && f.designNumber === params.designNumber,
          );
          if (exactIndex >= 0) {
            // Exact design already exists → remove it
            return {
              ...tooth,
              findings: tooth.findings.filter((_, i) => i !== exactIndex),
            };
          }
          // Not present → add alongside any existing designs
          return {
            ...tooth,
            findings: [...tooth.findings, { ...newFinding, id: generateId() }],
          };
        }

        // SINGLE-DESIGN or NO-DESIGN findings
        const existingIndex = tooth.findings.findIndex((f) => f.findingId === params.findingId);

        if (existingIndex >= 0) {
          const existingFinding = tooth.findings[existingIndex];

          if (hasDesigns && existingFinding.designNumber !== params.designNumber) {
            // Different design → REPLACE (update designNumber & color)
            return {
              ...tooth,
              findings: tooth.findings.map((f, i) =>
                i === existingIndex ? { ...f, designNumber, color: params.color, subOptionId: params.subOptionId } : f,
              ),
            };
          }

          // Same design or no designs → toggle OFF
          return {
            ...tooth,
            findings: tooth.findings.filter((_, i) => i !== existingIndex),
          };
        }

        // No existing finding → add
        return {
          ...tooth,
          findings: [...tooth.findings, { ...newFinding, id: generateId() }],
        };
      });

      const newSpacingFindings = { ...data.spacingFindings };

      // Si es row-finding con spacing (7, 31), toggle spacings de la posición
      if (isRowFinding(params.findingId) && data.spacingFindings[params.findingId]) {
        const spaces = data.spacingFindings[params.findingId];
        const wasActive = data.teeth
          .find((t) => t.toothId === params.toothId)
          ?.findings.some((f) => f.findingId === params.findingId);

        const posTeethIds = new Set(config.teeth[position].map((t) => t.id));

        if (!wasActive) {
          const updatedSpaces = spaces.map((space) => {
            if (!posTeethIds.has(space.leftToothId) && !posTeethIds.has(space.rightToothId)) return space;
            if (space.findings.some((f) => f.findingId === params.findingId)) return space;
            return {
              ...space,
              findings: [
                ...space.findings,
                { id: generateId(), findingId: params.findingId, color: params.color, designNumber: 1 } as SpaceFinding,
              ],
            };
          });
          newSpacingFindings[params.findingId] = updatedSpaces;
        } else {
          const updatedSpaces = spaces.map((space) => {
            if (!posTeethIds.has(space.leftToothId) && !posTeethIds.has(space.rightToothId)) return space;
            return { ...space, findings: space.findings.filter((f) => f.findingId !== params.findingId) };
          });
          newSpacingFindings[params.findingId] = updatedSpaces;
        }
      }

      // =====================================================================
      // BIDIRECTIONAL CASCADE para hallazgos con adyacencia (1, 2, 30, 32, 39)
      // =====================================================================
      if (usesAdjacencyLogic(params.findingId)) {
        const spacesForFinding = newSpacingFindings[params.findingId] || [];

        // 1) Recalcular diseños de ESPACIOS basándose en DIENTES actualizados
        newSpacingFindings[params.findingId] = recalculateSpacingDesigns(spacesForFinding, params.findingId, newTeeth);

        // 2) Recalcular diseños de DIENTES basándose en ESPACIOS actualizados
        newTeeth = recalculateToothDesigns(newTeeth, params.findingId, newSpacingFindings[params.findingId]);
      }

      // =====================================================================
      // BIDIRECTIONAL CASCADE diente↔legendSpace para hallazgos como 11
      // =====================================================================
      let newLegendSpaces = data.legendSpaces;
      if (usesToothAdjacencyLogic(params.findingId)) {
        // 1) Recalcular legend space designs basándose en DIENTES actualizados
        newLegendSpaces = recalculateLegendDesigns(newLegendSpaces, params.findingId, newTeeth);
        // 2) Recalcular tooth designs basándose en LEGEND SPACES actualizados
        newTeeth = recalculateToothDesignsFromLegendSpaces(newTeeth, params.findingId, newLegendSpaces);
      }

      const newData: OdontogramData = {
        ...data,
        teeth: newTeeth,
        spacingFindings: newSpacingFindings,
        legendSpaces: newLegendSpaces,
      };
      // Recompute annotations for all teeth that changed
      newData.teeth = newData.teeth.map((tooth) => ({
        ...tooth,
        annotations: computeToothAnnotations(tooth.findings, config.findingOptions),
      }));
      emit(newData);
    },
    [data, config, readOnly, emit],
  );

  const removeToothFinding = useCallback(
    (params: { toothId: number; findingId: number; instanceId?: string }) => {
      if (readOnly) return;

      // For row findings (7, 31), determine the arch and remove from all teeth + spacings
      const position = config.teeth.upper.some((t) => t.id === params.toothId) ? 'upper' : 'lower';
      const isRow = isRowFinding(params.findingId);
      const toothIdsToRemove = isRow ? config.teeth[position].map((t) => t.id) : [params.toothId];

      const newTeeth = data.teeth.map((tooth) => {
        if (!toothIdsToRemove.includes(tooth.toothId)) return tooth;

        // For row findings always remove all instances by findingId (ignore instanceId)
        const newFindings =
          isRow || !params.instanceId
            ? tooth.findings.filter((f) => f.findingId !== params.findingId)
            : tooth.findings.filter((f) => f.id !== params.instanceId);

        return { ...tooth, findings: newFindings };
      });

      // Recompute annotations for affected teeth
      const teethWithAnnotations = newTeeth.map((tooth) =>
        toothIdsToRemove.includes(tooth.toothId)
          ? { ...tooth, annotations: computeToothAnnotations(tooth.findings, config.findingOptions) }
          : tooth,
      );

      // For row findings, also remove from spacingFindings
      const newSpacingFindings = { ...data.spacingFindings };
      if (isRow && data.spacingFindings[params.findingId]) {
        const posTeethIds = new Set(config.teeth[position].map((t) => t.id));
        newSpacingFindings[params.findingId] = data.spacingFindings[params.findingId].map((space) => {
          if (!posTeethIds.has(space.leftToothId) && !posTeethIds.has(space.rightToothId)) return space;
          return { ...space, findings: space.findings.filter((f) => f.findingId !== params.findingId) };
        });
      }

      emit({ ...data, teeth: teethWithAnnotations, spacingFindings: newSpacingFindings });
    },
    [data, config.findingOptions, config.teeth, readOnly, emit],
  );

  const updateToothNotes = useCallback(
    (toothId: number, notes: string) => {
      if (readOnly) return;
      const newTeeth = data.teeth.map((tooth) => (tooth.toothId === toothId ? { ...tooth, notes } : tooth));
      emit({ ...data, teeth: newTeeth });
    },
    [data, readOnly, emit],
  );

  // ---------------------------------------------------------------------------
  // Spacing Actions
  // ---------------------------------------------------------------------------
  const toggleSpacingFinding = useCallback(
    (params: {
      findingId: number;
      leftToothId: number;
      rightToothId: number;
      color: FindingColor;
      designNumber?: number | null;
    }) => {
      if (readOnly) return;

      // Row findings tienen spacing deshabilitado para clicks directos
      if (isRowFinding(params.findingId)) return;

      const findingId = params.findingId;
      const spaces = data.spacingFindings[findingId] || [];

      // Encontrar el espacio correcto
      const spaceIndex = spaces.findIndex(
        (s) => s.leftToothId === params.leftToothId && s.rightToothId === params.rightToothId,
      );

      if (spaceIndex < 0) return;

      const space = spaces[spaceIndex];
      const existingFindingIdx = space.findings.findIndex((f) => f.findingId === findingId);

      let updatedSpaces: SpaceData[];

      if (existingFindingIdx >= 0) {
        // Toggle off: remover
        updatedSpaces = spaces.map((s, i) =>
          i === spaceIndex
            ? {
                ...s,
                findings: s.findings.filter((_, fi) => fi !== existingFindingIdx),
              }
            : s,
        );
      } else {
        // Toggle on: agregar
        const newSpaceFinding: SpaceFinding = {
          id: generateId(),
          findingId,
          color: params.color,
          designNumber: params.designNumber ?? 1,
        };

        updatedSpaces = spaces.map((s, i) =>
          i === spaceIndex ? { ...s, findings: [...s.findings, newSpaceFinding] } : s,
        );
      }

      // ---- Bidirectional cascade ----
      let newTeeth = [...data.teeth];

      if (usesAdjacencyLogic(findingId)) {
        // 1. Recalculate spacing designs from teeth
        updatedSpaces = recalculateSpacingDesigns(updatedSpaces, findingId, newTeeth);
        // 2. Recalculate tooth designs from updated spaces
        newTeeth = recalculateToothDesigns(newTeeth, findingId, updatedSpaces);
      }

      // Para hallazgos con posición-dependiente design (24, 25)
      if (usesPositionLogic(findingId) && existingFindingIdx < 0) {
        const position = getToothPosition(params.leftToothId, config);
        if (position) {
          const designNum = getPositionBasedDesign(position);
          updatedSpaces = updatedSpaces.map((s, i) =>
            i === spaceIndex
              ? {
                  ...s,
                  findings: s.findings.map((f) => (f.findingId === findingId ? { ...f, designNumber: designNum } : f)),
                }
              : s,
          );
        }
      }

      const newData: OdontogramData = {
        ...data,
        teeth: newTeeth,
        spacingFindings: {
          ...data.spacingFindings,
          [findingId]: updatedSpaces,
        },
      };

      emit(newData);
    },
    [data, config, readOnly, emit],
  );

  // ---------------------------------------------------------------------------
  // Legend Actions
  // ---------------------------------------------------------------------------
  const toggleLegendFinding = useCallback(
    (params: { leftToothId: number; rightToothId: number; findingId: number; color: FindingColor }) => {
      if (readOnly) return;

      const legendSpaces = [...data.legendSpaces];
      const index = legendSpaces.findIndex(
        (ls) => ls.leftToothId === params.leftToothId && ls.rightToothId === params.rightToothId,
      );

      if (index < 0) return;

      const space = legendSpaces[index];
      const existingIdx = space.findings.findIndex((f) => f.findingId === params.findingId);

      let updatedSpaces: LegendSpaceData[];

      if (existingIdx >= 0) {
        // Toggle off
        updatedSpaces = legendSpaces.map((ls, i) =>
          i === index
            ? {
                ...ls,
                findings: ls.findings.filter((_, fi) => fi !== existingIdx),
              }
            : ls,
        );
      } else {
        // Toggle on
        const designNum = calculateLegendDesign(legendSpaces, index, params.findingId);
        const newFinding: SpaceFinding = {
          id: generateId(),
          findingId: params.findingId,
          color: params.color,
          designNumber: designNum,
        };
        updatedSpaces = legendSpaces.map((ls, i) =>
          i === index ? { ...ls, findings: [...ls.findings, newFinding] } : ls,
        );
      }

      // Bidirectional cascade: legendSpaces ↔ teeth
      // 1) Recalcular legend space designs basándose en DIENTES
      updatedSpaces = recalculateLegendDesigns(updatedSpaces, params.findingId, data.teeth);
      // 2) Recalcular tooth designs basándose en LEGEND SPACES actualizados
      const newTeethFromLegend = recalculateToothDesignsFromLegendSpaces(data.teeth, params.findingId, updatedSpaces);

      emit({ ...data, teeth: newTeethFromLegend, legendSpaces: updatedSpaces });
    },
    [data, readOnly, emit],
  );

  // ---------------------------------------------------------------------------
  // Context value (memoizado)
  // ---------------------------------------------------------------------------
  const contextValue = useMemo<OdontogramContextValue>(
    () => ({
      config,
      readOnly,
      data,
      // Read-only instances never expose an active selection — consumers see
      // no grey overlays, no expanded rows, no interactive highlights.
      formSelection: readOnly ? EMPTY_FORM_SELECTION : formSelection,
      formActions: {
        selectFinding,
        selectColor,
        selectSuboption,
        selectDesign,
        resetSelection,
      },
      toothActions: {
        registerToothFinding,
        removeToothFinding,
        updateToothNotes,
      },
      spacingActions: {
        toggleSpacingFinding,
      },
      legendActions: {
        toggleLegendFinding,
      },
      getToothConfig,
      getTeethByPosition,
      getFindingOption,
      showToast,
    }),
    [
      config,
      readOnly,
      data,
      formSelection,
      selectFinding,
      selectColor,
      selectSuboption,
      selectDesign,
      resetSelection,
      registerToothFinding,
      removeToothFinding,
      updateToothNotes,
      toggleSpacingFinding,
      toggleLegendFinding,
      getToothConfig,
      getTeethByPosition,
      getFindingOption,
      showToast,
    ],
  );

  return <OdontogramContext.Provider value={contextValue}>{children}</OdontogramContext.Provider>;
}
