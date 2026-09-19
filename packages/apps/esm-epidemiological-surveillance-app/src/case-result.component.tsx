import { InlineNotification, Tile } from "@carbon/react";
import { useTranslation } from "react-i18next";
import { moduleName } from "./constants";
import type { CaseResult } from "./types";
export function CaseResultView({ result }: { result: CaseResult }) {
  const { t } = useTranslation(moduleName);
  return (
    <section aria-label={t("caseAssessment", "Case assessment")}>
      <Tile>
        <p>{t("savedOnServer", "Case registered on the server")}</p>
        <p>
          {t("icd10", "ICD-10")}:{" "}
          {result.icd10 || t("notAvailable", "Not available")}
        </p>
        <p>
          {t("periodicity", "Notification frequency")}:{" "}
          {t(`periodicityValues.${result.periodicity}`)}
        </p>
      </Tile>
      {result.immediateAlerts.map((code) => (
        <InlineNotification
          key={code}
          kind="error"
          lowContrast
          hideCloseButton
          title={t("immediateNotification", "Immediate notification required")}
          subtitle={t(`alerts.${code}`)}
        />
      ))}
      {result.outbreakAlerts.map((code) => (
        <InlineNotification
          key={code}
          kind="warning"
          lowContrast
          hideCloseButton
          title={t("outbreakAlert", "Outbreak alert")}
          subtitle={t(`alerts.${code}`)}
        />
      ))}
      {result.warnings.map((code) => (
        <InlineNotification
          key={code}
          kind="info"
          lowContrast
          hideCloseButton
          title={t(
            "assessmentIncomplete",
            "Assessment requires additional information",
          )}
          subtitle={t(`alerts.${code}`)}
        />
      ))}
    </section>
  );
}
