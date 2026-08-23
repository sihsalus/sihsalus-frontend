import { launchWorkspace2, showSnackbar } from "@openmrs/esm-framework";
import { usePatientChartStore } from "@openmrs/esm-patient-common-lib";
import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAmbulatoryVisitGuard } from "./useAmbulatoryVisitGuard";

const visitNotesWorkspace = "visit-notes-form-workspace";

interface ConsultaExternaVisitNoteLauncherOptions {
  patientUuid: string;
  ambulatoryVisitTypeUuid?: string | null;
  mutate?: () => unknown;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Opens the canonical structured visit summary only inside a verified active
 * outpatient visit. The workspace owns the one-summary-per-visit resolution so
 * every entry point (Consulta Externa, end visit and shared actions) follows the
 * same create/edit/duplicate policy.
 */
export function useConsultaExternaVisitNoteLauncher({
  patientUuid,
  ambulatoryVisitTypeUuid,
  mutate,
}: ConsultaExternaVisitNoteLauncherOptions): () => void {
  const { t } = useTranslation();
  const patientChartContext = usePatientChartStore(patientUuid);
  const { requireAmbulatoryVisit } = useAmbulatoryVisitGuard({
    patientUuid,
    ambulatoryVisitTypeUuid,
  });
  const launchInProgressRef = useRef(false);

  const showLaunchError = useCallback(() => {
    showSnackbar({
      isLowContrast: false,
      kind: "error",
      title: t("consultationFormOpenError", "Could not open the clinical form"),
      subtitle: t(
        "consultationFormVerificationError",
        "The existing clinical record could not be verified. Reload and try again.",
      ),
    });
  }, [t]);

  return useCallback(() => {
    if (launchInProgressRef.current) {
      return;
    }

    const currentVisit = requireAmbulatoryVisit();
    if (!currentVisit) {
      return;
    }

    if (!isNonEmptyString(patientUuid)) {
      showLaunchError();
      return;
    }

    const onAfterSave = () => {
      try {
        return Promise.resolve(mutate?.()).then(
          () => undefined,
          () => undefined,
        );
      } catch {
        return undefined;
      }
    };

    launchInProgressRef.current = true;
    void launchWorkspace2(visitNotesWorkspace, { onAfterSave }, null, {
      patientUuid,
      patient: patientChartContext.patient,
      // The same exact visit passed the outpatient guard and is consumed by
      // the centralized visit-note resolver/save path.
      visitContext: currentVisit,
      mutateVisitContext: patientChartContext.mutateVisitContext,
    })
      .then((didOpen) => {
        if (didOpen === false) {
          showLaunchError();
        }
      })
      .catch(() => showLaunchError())
      .finally(() => {
        launchInProgressRef.current = false;
      });
  }, [
    mutate,
    patientChartContext.mutateVisitContext,
    patientChartContext.patient,
    patientUuid,
    requireAmbulatoryVisit,
    showLaunchError,
  ]);
}
