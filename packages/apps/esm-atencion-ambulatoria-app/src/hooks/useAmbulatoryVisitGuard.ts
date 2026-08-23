import { showSnackbar, type Visit } from "@openmrs/esm-framework";
import {
  launchStartVisitPrompt,
  useVisitOrOfflineVisit,
} from "@openmrs/esm-patient-common-lib";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

export interface VerifiedAmbulatoryVisit extends Visit {
  uuid: string;
  startDatetime: string;
  visitType: NonNullable<Visit["visitType"]> & {
    uuid: string;
  };
}

interface AmbulatoryVisitGuardOptions {
  patientUuid: string;
  ambulatoryVisitTypeUuid?: string | null;
}

interface AmbulatoryVisitGuard {
  requireAmbulatoryVisit: () => VerifiedAmbulatoryVisit | null;
}

/**
 * Returns the active visit only when its identity and outpatient type have been
 * verified. Every other state fails closed; absence of a visit opens the shared
 * start-visit prompt, while loading and error states remain user-visible.
 */
export function useAmbulatoryVisitGuard({
  patientUuid,
  ambulatoryVisitTypeUuid,
}: AmbulatoryVisitGuardOptions): AmbulatoryVisitGuard {
  const { t } = useTranslation();
  const { currentVisit, error, isLoading, isValidating } =
    useVisitOrOfflineVisit(patientUuid);

  const showVisitError = useCallback(
    (subtitle: string) => {
      showSnackbar({
        isLowContrast: false,
        kind: "error",
        title: t(
          "consultationFormOpenError",
          "Could not open the clinical form",
        ),
        subtitle,
      });
    },
    [t],
  );

  const requireAmbulatoryVisit =
    useCallback((): VerifiedAmbulatoryVisit | null => {
      if (isLoading || isValidating) {
        showVisitError(
          t(
            "consultationVisitVerificationPending",
            "The active outpatient visit is still being verified. Please try again in a moment.",
          ),
        );
        return null;
      }

      if (error) {
        showVisitError(
          t(
            "consultationVisitVerificationError",
            "The active outpatient visit could not be verified. Reload and try again.",
          ),
        );
        return null;
      }

      if (!currentVisit) {
        launchStartVisitPrompt();
        return null;
      }

      if (!ambulatoryVisitTypeUuid) {
        showVisitError(
          t(
            "consultationVisitConfigurationError",
            "The outpatient visit type is not configured. Contact your system administrator.",
          ),
        );
        return null;
      }

      if (
        !currentVisit.uuid ||
        !currentVisit.startDatetime ||
        currentVisit.visitType?.uuid?.toLowerCase() !==
          ambulatoryVisitTypeUuid.toLowerCase()
      ) {
        showVisitError(
          t(
            "ambulatoryVisitRequired",
            "An active Outpatient Care visit is required to record this information.",
          ),
        );
        return null;
      }

      return currentVisit as VerifiedAmbulatoryVisit;
    }, [
      ambulatoryVisitTypeUuid,
      currentVisit,
      error,
      isLoading,
      isValidating,
      showVisitError,
      t,
    ]);

  return { requireAmbulatoryVisit };
}
