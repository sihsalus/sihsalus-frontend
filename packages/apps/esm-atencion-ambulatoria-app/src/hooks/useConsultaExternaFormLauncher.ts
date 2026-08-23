import {
  openmrsFetch,
  restBaseUrl,
  showSnackbar,
} from "@openmrs/esm-framework";
import { launchPatientWorkspace } from "@openmrs/esm-patient-common-lib";
import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { patientFormEntryWorkspace } from "../utils/constants";
import { useAmbulatoryVisitGuard } from "./useAmbulatoryVisitGuard";

export type ConsultaExternaFormEntryMode = "one-per-visit" | "repeatable";

interface ConsultaExternaFormLauncherOptions {
  patientUuid: string;
  formIdentifier?: string | null;
  encounterTypeUuid?: string | null;
  ambulatoryVisitTypeUuid?: string | null;
  mutate?: () => unknown;
  entryMode: ConsultaExternaFormEntryMode;
}

interface OpenmrsFormReference {
  uuid: string;
  name?: string;
  display?: string;
  published?: boolean;
  retired?: boolean;
  encounterType?: {
    uuid?: string;
  } | null;
}

interface EncounterReference {
  uuid: string;
  form?: {
    uuid?: string;
  } | null;
  patient?: {
    uuid?: string;
  } | null;
  visit?: {
    uuid?: string;
  } | null;
  encounterType?: {
    uuid?: string;
  } | null;
}

interface RestListResponse<T> {
  results?: Array<T>;
  links?: Array<{
    rel?: string;
  }>;
}

type LaunchFailureCode =
  | "form-unavailable"
  | "multiple-encounters"
  | "verification-failed";

class ConsultaExternaLaunchError extends Error {
  constructor(readonly code: LaunchFailureCode) {
    super(code);
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const formRepresentation =
  "custom:(uuid,name,display,published,retired,encounterType:(uuid))";
const encounterRepresentation =
  "custom:(uuid,patient:(uuid),visit:(uuid),encounterType:(uuid),form:(uuid))";

function createRestUrl(
  resource: string,
  params: Record<string, string>,
): string {
  const searchParams = new URLSearchParams(params);
  return `${restBaseUrl}/${resource}?${searchParams.toString()}`;
}

function hasUsableFormState(form: OpenmrsFormReference): boolean {
  return Boolean(
    form.uuid && form.retired === false && form.published === true,
  );
}

async function resolvePublishedForm(
  formIdentifier: string,
  expectedEncounterTypeUuid: string,
): Promise<OpenmrsFormReference> {
  if (UUID_PATTERN.test(formIdentifier)) {
    const url = createRestUrl(`form/${formIdentifier}`, {
      v: formRepresentation,
    });
    const response = await openmrsFetch<OpenmrsFormReference>(url);
    const form = response.data;

    if (
      !form ||
      form.uuid !== formIdentifier ||
      !hasUsableFormState(form) ||
      form.encounterType?.uuid !== expectedEncounterTypeUuid
    ) {
      throw new ConsultaExternaLaunchError("form-unavailable");
    }

    return form;
  }

  const url = createRestUrl("form", {
    q: formIdentifier,
    v: formRepresentation,
    limit: "100",
  });
  const response =
    await openmrsFetch<RestListResponse<OpenmrsFormReference>>(url);
  if (
    !Array.isArray(response.data?.results) ||
    response.data.links?.some((link) => link.rel === "next")
  ) {
    throw new ConsultaExternaLaunchError("verification-failed");
  }

  const exactPublishedMatches = response.data.results.filter(
    (form) => form.name === formIdentifier && hasUsableFormState(form),
  );
  if (exactPublishedMatches.length !== 1) {
    throw new ConsultaExternaLaunchError("form-unavailable");
  }

  const form = exactPublishedMatches[0];
  if (form.encounterType?.uuid !== expectedEncounterTypeUuid) {
    throw new ConsultaExternaLaunchError("form-unavailable");
  }

  return form;
}

async function findSingleEncounterForVisit(
  patientUuid: string,
  visitUuid: string,
  encounterTypeUuid: string,
  formUuid: string,
): Promise<string | undefined> {
  const url = createRestUrl("encounter", {
    patient: patientUuid,
    visit: visitUuid,
    encounterType: encounterTypeUuid,
    form: formUuid,
    v: encounterRepresentation,
    limit: "2",
  });
  const response =
    await openmrsFetch<RestListResponse<EncounterReference>>(url);
  if (!Array.isArray(response.data?.results)) {
    throw new ConsultaExternaLaunchError("verification-failed");
  }

  // Verify every REST filter so a changed backend cannot make us edit an
  // unrelated patient's encounter or an encounter from another visit/type/form.
  const hasUnexpectedIdentity = response.data.results.some(
    (encounter) =>
      !encounter.uuid ||
      encounter.patient?.uuid !== patientUuid ||
      encounter.visit?.uuid !== visitUuid ||
      encounter.encounterType?.uuid !== encounterTypeUuid ||
      encounter.form?.uuid !== formUuid,
  );
  if (hasUnexpectedIdentity) {
    throw new ConsultaExternaLaunchError("verification-failed");
  }

  if (response.data.results.length > 1) {
    throw new ConsultaExternaLaunchError("multiple-encounters");
  }

  return response.data.results[0]?.uuid;
}

/**
 * Opens an AMPATH form only after resolving a verified active outpatient visit.
 *
 * Anamnesis and SOAP use `one-per-visit`, which edits the sole matching encounter
 * and blocks ambiguous duplicates. Referral uses `repeatable`: every referral is
 * a distinct clinical event, but it is still attached to the verified visit.
 */
export function useConsultaExternaFormLauncher({
  patientUuid,
  formIdentifier,
  encounterTypeUuid,
  ambulatoryVisitTypeUuid,
  mutate,
  entryMode,
}: ConsultaExternaFormLauncherOptions): () => void {
  const { t } = useTranslation();
  const { requireAmbulatoryVisit } = useAmbulatoryVisitGuard({
    patientUuid,
    ambulatoryVisitTypeUuid,
  });
  const launchInProgressRef = useRef(false);

  const showLaunchError = useCallback(
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

  return useCallback(() => {
    if (launchInProgressRef.current) {
      return;
    }

    const currentVisit = requireAmbulatoryVisit();
    if (!currentVisit) {
      return;
    }

    if (!formIdentifier || !encounterTypeUuid) {
      showLaunchError(
        t(
          "consultationFormConfigurationError",
          "This clinical form is not configured. Contact your system administrator.",
        ),
      );
      return;
    }

    launchInProgressRef.current = true;

    void (async () => {
      try {
        const form = await resolvePublishedForm(
          formIdentifier,
          encounterTypeUuid,
        );
        const encounterUuid =
          entryMode === "one-per-visit"
            ? await findSingleEncounterForVisit(
                patientUuid,
                currentVisit.uuid,
                encounterTypeUuid,
                form.uuid,
              )
            : undefined;

        const handleFormClose = () => {
          launchInProgressRef.current = false;
          try {
            void Promise.resolve(mutate?.()).catch(() => undefined);
          } catch {
            // A cache refresh failure must not prevent the saved form workspace
            // from closing; the history can be refreshed on the next load.
          }
        };

        launchPatientWorkspace(patientFormEntryWorkspace, {
          workspaceTitle: form.display ?? form.name,
          mutateForm: handleFormClose,
          formInfo: {
            patientUuid,
            formUuid: form.uuid,
            encounterUuid,
            visitUuid: currentVisit.uuid,
            visitTypeUuid: currentVisit.visitType.uuid,
            visitStartDatetime: currentVisit.startDatetime,
            visitStopDatetime: currentVisit.stopDatetime ?? undefined,
          },
        });
        // Keep the guard locked while the workspace is open. The legacy form
        // workspace invokes mutateForm on close, which releases it safely.
      } catch (launchError) {
        launchInProgressRef.current = false;

        if (
          launchError instanceof ConsultaExternaLaunchError &&
          launchError.code === "multiple-encounters"
        ) {
          showLaunchError(
            t(
              "multipleConsultationFormEncounters",
              "More than one record of this form exists in the active visit. Resolve the duplicate before editing.",
            ),
          );
          return;
        }

        if (
          launchError instanceof ConsultaExternaLaunchError &&
          launchError.code === "form-unavailable"
        ) {
          showLaunchError(
            t(
              "consultationFormUnavailable",
              "The configured clinical form is unavailable or ambiguous. Contact your system administrator.",
            ),
          );
          return;
        }

        showLaunchError(
          t(
            "consultationFormVerificationError",
            "The existing clinical record could not be verified. Reload and try again.",
          ),
        );
      }
    })();
  }, [
    encounterTypeUuid,
    entryMode,
    formIdentifier,
    mutate,
    patientUuid,
    requireAmbulatoryVisit,
    showLaunchError,
    t,
  ]);
}
