import React, { useCallback, useEffect, useState } from 'react';
import type { FindingOptionConfig, ToothAnnotation, ToothFinding, ToothRootDesign } from '../types/odontogram';
import { COLOR_CSS, COLOR_LABEL, TOOTH_DESIGN_COMPONENT_MAP } from './constants';
import Tooth from './Tooth';
import ToothDesigns from './ToothDesigns';
import './ToothInfoModal.css';

interface ToothInfoModalProps {
  toothId: number;
  findings: ToothFinding[];
  annotations: ToothAnnotation[];
  findingOptions: FindingOptionConfig[];
  zones: number;
  rootDesign: ToothRootDesign;
  readOnly: boolean;
  onRemoveFinding: (params: { toothId: number; findingId: number; instanceId?: string }) => void;
  onRegisterFinding: (params: {
    toothId: number;
    findingId: number;
    subOptionId?: number;
    color: { id: number; name: string };
    designNumber?: number | null;
  }) => void;
  onClose: () => void;
}

const ToothInfoModal: React.FC<ToothInfoModalProps> = ({
  toothId,
  findings,
  annotations,
  findingOptions,
  zones,
  rootDesign,
  readOnly,
  onRemoveFinding,
  onRegisterFinding,
  onClose,
}) => {
  // Map of instanceId → finding for inline undo rows (no timeout — stays until user acts)
  const [removedItems, setRemovedItems] = useState<Map<string, ToothFinding>>(new Map());

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const getFindingName = useCallback(
    (findingId: number) => findingOptions.find((o) => o.id === findingId)?.nombre ?? `Hallazgo ${findingId}`,
    [findingOptions],
  );

  const getSuboptionName = useCallback(
    (findingId: number, subOptionId?: number) => {
      if (subOptionId == null) return null;
      const cfg = findingOptions.find((o) => o.id === findingId);
      return cfg?.subopciones?.find((s) => s.id === subOptionId)?.nombre ?? null;
    },
    [findingOptions],
  );

  const handleDelete = useCallback(
    (finding: ToothFinding) => {
      onRemoveFinding({ toothId, findingId: finding.findingId, instanceId: finding.id });
      setRemovedItems((prev) => new Map(prev).set(finding.id, finding));
    },
    [toothId, onRemoveFinding],
  );

  const handleUndo = useCallback(
    (instanceId: string) => {
      const f = removedItems.get(instanceId);
      if (!f) return;
      onRegisterFinding({
        toothId,
        findingId: f.findingId,
        subOptionId: f.subOptionId,
        color: f.color,
        designNumber: f.designNumber,
      });
      setRemovedItems((prev) => {
        const next = new Map(prev);
        next.delete(instanceId);
        return next;
      });
    },
    [removedItems, onRegisterFinding, toothId],
  );

  // Render design preview for a finding
  const renderDesignPreview = (finding: ToothFinding) => {
    const fKey = String(finding.findingId);
    const dKey = String(finding.designNumber);
    const comps = TOOTH_DESIGN_COMPONENT_MAP[fKey];
    const Comp = comps?.[dKey];
    if (!Comp) return null;
    return (
      <svg width="40" height="80" viewBox="0 0 60 120" className="tim-design-preview">
        <ToothDesigns design={rootDesign} />
        <Tooth zones={zones} />
        <Comp strokeColor={finding.color?.name || 'black'} />
      </svg>
    );
  };

  // Group findings by findingId for clearer display
  const groupedFindings = React.useMemo(() => {
    const map = new Map<number, ToothFinding[]>();
    for (const f of findings) {
      let arr = map.get(f.findingId);
      if (!arr) {
        arr = [];
        map.set(f.findingId, arr);
      }
      arr.push(f);
    }
    return Array.from(map.entries()).map(([fId, items]) => ({
      findingId: fId,
      name: getFindingName(fId),
      items,
    }));
  }, [findings, getFindingName]);

  return (
    <div
      className="tim-backdrop"
      role="button"
      tabIndex={0}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="tim-modal">
        {/* Header */}
        <div className="tim-header">
          <div className="tim-header-left">
            <span className="tim-tooth-id">Diente {toothId}</span>
            <span className="tim-finding-count">
              {findings.length} hallazgo{findings.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button type="button" className="tim-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="tim-body">
          {/* Overview section: tooth preview + annotations */}
          <div className="tim-overview">
            <div className="tim-tooth-preview">
              <svg width="60" height="120" viewBox="0 0 60 120">
                <ToothDesigns design={rootDesign} />
                <Tooth zones={zones} />
                {findings.map((f, i) => {
                  const comps = TOOTH_DESIGN_COMPONENT_MAP[String(f.findingId)];
                  const Comp = comps?.[String(f.designNumber)];
                  if (!Comp) return null;
                  return (
                    <g key={f.id || i}>
                      <Comp strokeColor={f.color?.name || 'black'} />
                    </g>
                  );
                })}
              </svg>
            </div>
            {annotations.length > 0 && (
              <div className="tim-annotations">
                <span className="tim-section-label">Anotaciones</span>
                <div className="tim-annotation-chips">
                  {annotations.map((ann, i) => (
                    <span
                      key={`${ann.findingId}-${ann.text}-${i}`}
                      className="tim-annotation-chip"
                      style={{ color: COLOR_CSS[ann.color] ?? ann.color }}
                    >
                      {ann.text}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Findings list */}
          {groupedFindings.length === 0 && removedItems.size === 0 ? (
            <div className="tim-empty">Sin hallazgos aplicados</div>
          ) : (
            <div className="tim-findings-list">
              {groupedFindings.map((group) => {
                // Removed items that belong to this group
                const ghostsForGroup = Array.from(removedItems.values()).filter((f) => f.findingId === group.findingId);
                return (
                  <div key={group.findingId} className="tim-finding-group">
                    <div className="tim-group-header">
                      <span className="tim-group-name">{group.name}</span>
                      <span className="tim-group-count">{group.items.length}</span>
                    </div>
                    {group.items.map((f) => {
                      const subName = getSuboptionName(f.findingId, f.subOptionId);
                      return (
                        <div key={f.id} className="tim-finding-row">
                          <div className="tim-finding-info">
                            {renderDesignPreview(f)}
                            <div className="tim-finding-meta">
                              {f.designNumber != null && <span className="tim-meta-tag">Diseño {f.designNumber}</span>}
                              {subName && <span className="tim-meta-tag tim-meta-tag--tipo">Tipo: {subName}</span>}
                              <span
                                className="tim-meta-color"
                                style={{ '--dot-color': COLOR_CSS[f.color?.name] ?? '#888' } as React.CSSProperties}
                              >
                                <span className="tim-color-dot" />
                                {COLOR_LABEL[f.color?.name] ?? f.color?.name}
                              </span>
                            </div>
                          </div>
                          {!readOnly && (
                            <div className="tim-finding-actions">
                              <button
                                type="button"
                                className="tim-btn tim-btn--remove"
                                onClick={() => handleDelete(f)}
                                title="Eliminar hallazgo"
                              >
                                ×
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* Ghost rows for recently removed items in this group */}
                    {ghostsForGroup.map((f) => {
                      const subName = getSuboptionName(f.findingId, f.subOptionId);
                      return (
                        <div key={f.id} className="tim-finding-row tim-finding-row--ghost">
                          <div className="tim-finding-info">
                            {renderDesignPreview(f)}
                            <div className="tim-finding-meta">
                              {f.designNumber != null && <span className="tim-meta-tag">Diseño {f.designNumber}</span>}
                              {subName && <span className="tim-meta-tag tim-meta-tag--tipo">Tipo: {subName}</span>}
                              <span
                                className="tim-meta-color"
                                style={{ '--dot-color': COLOR_CSS[f.color?.name] ?? '#888' } as React.CSSProperties}
                              >
                                <span className="tim-color-dot" />
                                {COLOR_LABEL[f.color?.name] ?? f.color?.name}
                              </span>
                            </div>
                          </div>
                          <div className="tim-finding-actions">
                            <span className="tim-ghost-label">Eliminado</span>
                            <button type="button" className="tim-btn tim-btn--undo" onClick={() => handleUndo(f.id)}>
                              Deshacer
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Ghost groups for removed items whose findingId no longer has a group */}
              {(() => {
                const existingFindingIds = new Set(groupedFindings.map((g) => g.findingId));
                const orphanGroups = new Map<number, ToothFinding[]>();
                removedItems.forEach((f) => {
                  if (!existingFindingIds.has(f.findingId)) {
                    const arr = orphanGroups.get(f.findingId) ?? [];
                    arr.push(f);
                    orphanGroups.set(f.findingId, arr);
                  }
                });
                return Array.from(orphanGroups.entries()).map(([fId, entries]) => (
                  <div key={`ghost-group-${fId}`} className="tim-finding-group tim-finding-group--ghost">
                    <div className="tim-group-header">
                      <span className="tim-group-name">{getFindingName(fId)}</span>
                      <span className="tim-group-count tim-group-count--ghost">0</span>
                    </div>
                    {entries.map((f) => {
                      const subName = getSuboptionName(f.findingId, f.subOptionId);
                      return (
                        <div key={f.id} className="tim-finding-row tim-finding-row--ghost">
                          <div className="tim-finding-info">
                            {renderDesignPreview(f)}
                            <div className="tim-finding-meta">
                              {f.designNumber != null && <span className="tim-meta-tag">Diseño {f.designNumber}</span>}
                              {subName && <span className="tim-meta-tag tim-meta-tag--tipo">Tipo: {subName}</span>}
                              <span
                                className="tim-meta-color"
                                style={{ '--dot-color': COLOR_CSS[f.color?.name] ?? '#888' } as React.CSSProperties}
                              >
                                <span className="tim-color-dot" />
                                {COLOR_LABEL[f.color?.name] ?? f.color?.name}
                              </span>
                            </div>
                          </div>
                          <div className="tim-finding-actions">
                            <span className="tim-ghost-label">Eliminado</span>
                            <button type="button" className="tim-btn tim-btn--undo" onClick={() => handleUndo(f.id)}>
                              Deshacer
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ToothInfoModal;
