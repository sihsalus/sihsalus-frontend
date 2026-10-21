import { TextInput } from "@carbon/react";
import type { ReactNode } from "react";

export function notificationLocalValue(value?: string): string {
  if (!value) return "";
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(value)) return value;
  const instant = Date.parse(value);
  return Number.isFinite(instant) ? new Date(instant - 5 * 3600000).toISOString().slice(0, 19) : "";
}
export function DateTimeInput({ id, labelText, value, disabled, invalid, invalidText, onChange }: {
  id: string; labelText: ReactNode; value: string; disabled?: boolean;
  invalid?: boolean; invalidText?: ReactNode;
  onChange: (event: { target: { value: string } }) => void;
}) {
  return <TextInput id={id} type="datetime-local" step="1"
    labelText={labelText} value={notificationLocalValue(value)}
    disabled={disabled} invalid={invalid} invalidText={invalidText}
    onChange={(event) => onChange({ target: { value: event.target.value ? `${event.target.value}-05:00` : "" } })} />;
}
