import { InlineNotification } from "@carbon/react";
import { getUserFacingErrorMessage } from "@openmrs/esm-framework";
import { useTranslation } from "react-i18next";
import { safeError } from "./api";
import { moduleName } from "./constants";
import en from "../translations/en.json";
export function ErrorNotification({ error }: { error: unknown }) {
  const { t } = useTranslation(moduleName);
  const failure = safeError(error);
  const message = getUserFacingErrorMessage(
    failure,
    t(
      "errors.SERVICE_UNAVAILABLE",
      "Please try again. Your pending records are preserved.",
    ),
    {
      log: false,
      codeMessages: Object.fromEntries(
        Object.keys(en.errors).map((code) => [code, t(`errors.${code}`)]),
      ),
    },
  );
  return (
    <InlineNotification
      kind="error"
      lowContrast
      hideCloseButton
      title={t("operationFailed", "Could not complete the operation")}
      subtitle={message}
    />
  );
}
