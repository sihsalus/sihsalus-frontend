import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { moduleName } from "./constants";
import styles from "./dashboard.scss";

// Fields required for saving; historical records may lack newer required fields.
export const requiredCaseFields = new Set([
  "patientUuid",
  "sourceEncounterUuid",
  "encounterUuid",
  "providerUuid",
  "locationUuid",
  "diagnosisUuid",
  "status",
  "diagnosisType",
  "habitualResidence",
  "vaccinationStatus",
  "surveillanceType",
  "investigationForm",
]);
export function RequiredFieldLabel({
  children,
  required = true,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  const { t } = useTranslation(moduleName);
  return (
    <>
      {children}
      {required && (
        <>
          {" "}
          ({t("requiredField")}){" "}
          <span className={styles.requiredAsterisk} aria-hidden="true">
            *
          </span>
        </>
      )}
    </>
  );
}
