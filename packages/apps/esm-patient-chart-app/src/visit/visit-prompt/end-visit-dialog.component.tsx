import {
  Button,
  InlineLoading,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@carbon/react";
import {
  getUserFacingErrorMessage,
  openmrsFetch,
  restBaseUrl,
  showSnackbar,
  toOmrsIsoString,
  useVisit,
} from "@openmrs/esm-framework";
import {
  fetchVisitInsurance,
  getSisFinancingState,
  launchPatientWorkspace,
} from "@openmrs/esm-patient-common-lib";
import React from "react";
import { useTranslation } from "react-i18next";
import { useInfiniteVisits2 } from "../visits-widget/visit.resource";

import styles from "./end-visit-dialog.scss";

const ModuleFuaRestURL = "/ws/module/fua";
const codigoPrestacionalFormFieldPath = "codigo-prestacional";

interface EndVisitDialogProps {
  patientUuid: string;
  closeModal: () => void;
}

interface VisitEncounterSummary {
  diagnoses?: Array<{
    rank?: number;
    voided?: boolean;
  }>;
  obs?: Array<{
    formFieldPath?: string;
    value?: unknown;
    display?: string;
  }>;
}

interface VisitEncounterSummaryPage {
  links?: Array<{ rel?: string }>;
  results?: Array<VisitEncounterSummary>;
}

interface RequiredVisitSummaryValidation {
  hasCodigoPrestacional: boolean;
  hasPrimaryDiagnosis: boolean;
}

function getObsTextValue(
  obs: NonNullable<VisitEncounterSummary["obs"]>[number],
) {
  if (obs.value == null) {
    return obs.display ?? "";
  }

  if (typeof obs.value === "object") {
    const value = obs.value as { display?: unknown; uuid?: unknown };
    return String(value.display ?? value.uuid ?? obs.display ?? "");
  }

  return String(obs.value);
}

async function validateRequiredVisitSummaryFields(
  patientUuid: string,
  visitUuid: string,
): Promise<RequiredVisitSummaryValidation> {
  const customRepresentation =
    "custom:(uuid,diagnoses:(rank,voided),obs:(formFieldPath,value,display))";
  const pageSize = 50;
  let startIndex = 0;
  let hasPrimaryDiagnosis = false;
  let hasCodigoPrestacional = false;

  // OpenMRS may cap collection responses even when a larger limit is requested.
  // Walk every page so a valid diagnosis or benefit code cannot be missed simply
  // because the visit contains more than 50 encounters.
  while (!(hasPrimaryDiagnosis && hasCodigoPrestacional)) {
    const { data } = await openmrsFetch<VisitEncounterSummaryPage>(
      `${restBaseUrl}/encounter?patient=${encodeURIComponent(patientUuid)}&visit=${encodeURIComponent(visitUuid)}` +
        `&v=${customRepresentation}&limit=${pageSize}&startIndex=${startIndex}`,
    );
    const encounters = data?.results ?? [];

    hasPrimaryDiagnosis ||= encounters.some((encounter) =>
      encounter.diagnoses?.some(
        (diagnosis) => diagnosis.rank === 1 && !diagnosis.voided,
      ),
    );
    hasCodigoPrestacional ||= encounters.some((encounter) =>
      encounter.obs?.some(
        (obs) =>
          obs.formFieldPath === codigoPrestacionalFormFieldPath &&
          Boolean(getObsTextValue(obs).trim()),
      ),
    );

    const hasNextPage =
      data?.links?.some(({ rel }) => rel === "next") ??
      encounters.length === pageSize;
    if (!hasNextPage || encounters.length === 0) {
      break;
    }
    startIndex += encounters.length;
  }

  return { hasPrimaryDiagnosis, hasCodigoPrestacional };
}

/**
 * This modal shows up when user clicks on the "End visit" button in the action menu within the
 * patient banner. It should only show when the patient has an active visit. See stop-visit.component.tsx
 * for the button.
 */
const EndVisitDialog: React.FC<EndVisitDialogProps> = ({
  patientUuid,
  closeModal,
}) => {
  const { t } = useTranslation();
  const { activeVisit, mutate } = useVisit(patientUuid);
  const { mutate: mutateInfiniteVisits } = useInfiniteVisits2(patientUuid);
  const [isFinalizing, setIsFinalizing] = React.useState(false);

  const handleEndVisitAndGenerateFUA = async () => {
    if (isFinalizing) {
      return;
    }

    if (!activeVisit) {
      showSnackbar({
        title: t("errorGeneratingFUA", "Error generating FUA"),
        kind: "error",
        isLowContrast: false,
        subtitle: t(
          "noActiveVisitForFua",
          "There is no active visit to create a FUA",
        ),
      });
      return;
    }

    try {
      setIsFinalizing(true);
      const shouldGenerateFua =
        getSisFinancingState(await fetchVisitInsurance(activeVisit.uuid)) ===
        "active";

      if (shouldGenerateFua) {
        const validation = await validateRequiredVisitSummaryFields(
          patientUuid,
          activeVisit.uuid,
        );
        const missingFields = [
          !validation.hasPrimaryDiagnosis
            ? t("primaryDiagnosis", "Primary diagnosis")
            : null,
          !validation.hasCodigoPrestacional
            ? t("codigoPrestacional", "Codigo Prestacional")
            : null,
        ].filter(Boolean);

        if (missingFields.length) {
          setIsFinalizing(false);
          closeModal();
          launchPatientWorkspace("visit-notes-form-workspace", {
            openedFrom: "end-visit-dialog",
          });
          showSnackbar({
            title: t(
              "missingRequiredVisitSummaryFields",
              "Missing required visit summary data",
            ),
            kind: "warning",
            isLowContrast: true,
            subtitle: t(
              "completeRequiredVisitSummaryFields",
              "Complete {{fields}} in Resumen de consulta before finalizing the visit.",
              { fields: missingFields.join(", ") },
            ),
          });
          return;
        }
      }

      try {
        await openmrsFetch(`${restBaseUrl}/clinicalvisitclosure`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: {
            visitUuid: activeVisit.uuid,
            stopDatetime: toOmrsIsoString(new Date()),
          },
        });
      } catch (error: unknown) {
        showSnackbar({
          title: t("errorEndingVisit", "Error ending visit"),
          kind: "error",
          isLowContrast: false,
          subtitle: getUserFacingErrorMessage(
            error,
            t(
              "errorEndingVisitMessage",
              "The visit was not ended. Review the connection and try again.",
            ),
            { logContext: "End visit" },
          ),
        });
        return;
      }

      void mutate();
      void mutateInfiniteVisits();

      if (shouldGenerateFua) {
        try {
          await openmrsFetch(
            `${ModuleFuaRestURL}/generateFromVisit/${encodeURIComponent(activeVisit.uuid)}`,
            {
              method: "POST",
            },
          );
        } catch (error: unknown) {
          closeModal();
          showSnackbar({
            title: t("visitEndedFuaPending", "Visit ended; FUA pending"),
            kind: "warning",
            isLowContrast: true,
            subtitle: getUserFacingErrorMessage(
              error,
              t(
                "visitEndedFuaPendingMessage",
                "The visit was ended, but the FUA could not be generated. Retry it from FUA management.",
              ),
              { logContext: "Generate FUA after visit closure" },
            ),
          });
          return;
        }
      }

      closeModal();

      showSnackbar({
        isLowContrast: true,
        kind: "success",
        subtitle: shouldGenerateFua
          ? t("visitEndedAndFUAGenerated", "Visit ended and FUA Generated")
          : t("visitEnded", "Visit ended"),
        title: shouldGenerateFua
          ? t("visitEndedAndFUAGenerated", "Visit ended and FUA Generated")
          : t("visitEnded", "Visit ended"),
      });
    } catch (error: unknown) {
      showSnackbar({
        title: t("errorValidatingVisitClosure", "Could not validate the visit"),
        kind: "error",
        isLowContrast: false,
        subtitle: getUserFacingErrorMessage(
          error,
          t(
            "errorValidatingVisitClosureMessage",
            "The visit was not ended because its coverage or clinical summary could not be validated. Try again.",
          ),
          { logContext: "Validate visit before closure" },
        ),
      });
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <div>
      <ModalHeader
        closeModal={closeModal}
        title={t(
          "endActiveVisitConfirmation",
          "Are you sure you want to end this active visit?",
        )}
      />
      <ModalBody>
        <p className={styles.bodyShort02}>
          {t(
            "youCanAddAdditionalEncounters",
            "You can add additional encounters to this visit in the visit summary.",
          )}
        </p>
        {isFinalizing ? (
          <InlineLoading
            description={t("finalizingVisit", "Finalizando consulta...")}
            status="active"
          />
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal} disabled={isFinalizing}>
          {t("cancel", "Cancel")}
        </Button>
        <Button
          kind="danger"
          onClick={() => void handleEndVisitAndGenerateFUA()}
          disabled={isFinalizing}
        >
          {isFinalizing
            ? t("finalizingVisit", "Finalizando consulta...")
            : t("endVisit_title", "Finalizar consulta")}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default EndVisitDialog;
