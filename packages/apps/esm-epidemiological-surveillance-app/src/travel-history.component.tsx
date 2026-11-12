import styles from "./dashboard.scss";
import { Button } from "@carbon/react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { moduleName } from "./constants";
import { DateInput } from "./date-input.component";
import { displayDate } from "./date-display";
import { InfectionAddressSelector } from "./infection-address-selector.component";
import { FieldError } from "./field-error.component";
import type { FieldErrors } from "./field-validation";
import type { TravelHistoryEntry } from "./types";

export function TravelHistory({ value = [], onChange, errors = {}, today, disabled = false }: {
  value?: TravelHistoryEntry[];
  onChange?: (value: TravelHistoryEntry[]) => void;
  errors?: FieldErrors;
  today?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation(moduleName);
  const id = useId();
  const update = (index: number, patch: Partial<TravelHistoryEntry>) =>
    onChange?.(value.map((entry, i) => i === index ? { ...entry, ...patch } : entry));
  return <fieldset disabled={disabled}>
    <legend>{t("travelHistory.title")}</legend>
    {value.length === 0 && !onChange && <p>{t("travelHistory.empty")}</p>}
    {value.map((entry, index) => {
      const prefix = `travelHistory[${index}].`;
      const error = (field: string) => errors[prefix + field] ? t(`validation.${errors[prefix + field]}`) : undefined;
      return <fieldset key={entry.uuid ?? entry.clientKey ?? `${id}-${index}`}>
        <legend>{t("travelHistory.trip", { number: index + 1 })}</legend>
        {onChange ? <>
          <div className={styles.travelFields}>
          <div>
          <InfectionAddressSelector id={`${id}-${index}-address`} label={t("travelHistory.place")}
            value={entry.travelAddress} display={entry.travelAddressDisplay} invalidText={error("travelAddress")}
            onChange={(travelAddress, travelAddressDisplay) => update(index, { travelAddress, travelAddressDisplay })} />
          </div>
          {(["startDate", "endDate"] as const).map((field) => <div key={field}><DateInput
            id={`${id}-${index}-${field}`} labelText={t(`travelHistory.${field}`)}
            value={entry[field]} max={today} disabled={disabled} invalid={!!error(field)} invalidText={error(field)}
            onChange={(event) => update(index, { [field]: event.target.value })} /></div>)}
          </div>
          <FieldError message={error("uuid")} />
          <Button kind="danger--ghost" disabled={disabled} onClick={() => onChange(value.filter((_, i) => i !== index))}>
            {t("travelHistory.remove")}
          </Button>
        </> : <dl className={styles.travelFields}>
          <div><dt>{t("travelHistory.place")}</dt><dd>{entry.travelAddressDisplay || t("infectionPreservedCenter")}</dd></div>
          <div><dt>{t("travelHistory.startDate")}</dt><dd>{displayDate(entry.startDate)}</dd></div>
          <div><dt>{t("travelHistory.endDate")}</dt><dd>{displayDate(entry.endDate)}</dd></div>
        </dl>}
      </fieldset>;
    })}
    {onChange && <Button kind="tertiary" disabled={disabled} onClick={() => onChange([...value, { clientKey: globalThis.crypto.randomUUID(), travelAddress: "", startDate: "", endDate: "" }])}>
      {t("travelHistory.add")}
    </Button>}
  </fieldset>;
}
