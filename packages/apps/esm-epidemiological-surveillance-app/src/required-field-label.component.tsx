import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { moduleName } from "./constants";
import styles from "./dashboard.scss";

// User-facing fields backed by NOT NULL columns in liquibase-surveillance-case.xml.
export const requiredCaseFields = new Set([
  "patientUuid",
  "sourceEncounterUuid",
  "encounterUuid",
  "providerUuid",
  "locationUuid",
  "diagnosisUuid",
  "status",
  "diagnosisType",
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
