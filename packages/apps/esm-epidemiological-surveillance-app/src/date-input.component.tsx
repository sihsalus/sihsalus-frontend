import { FieldError } from "./field-error.component";
import { DatePicker, DatePickerInput } from "@carbon/react";
import { type ReactNode, useRef } from "react";
import { displayDate } from "./date-display";
import styles from "./dashboard.scss";

function parseCalendarDate(text: string): Date | false {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) return false;
  const date = new Date(0);
  date.setFullYear(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  date.setHours(0, 0, 0, 0);
  return date.getFullYear() === Number(match[3]) &&
    date.getMonth() === Number(match[2]) - 1 &&
    date.getDate() === Number(match[1])
    ? date
    : false;
}

/** The API keeps ISO dates; the picker always presents day/month/year. */
export function DateInput({
  id,
  labelText,
  value,
  min,
  max,
  disabled,
  invalid,
  invalidText,
  onChange,
}: {
  id: string;
  labelText: ReactNode;
  value: string;
  type?: "date";
  min?: string;
  max?: string;
  disabled?: boolean;
  invalid?: boolean;
  invalidText?: ReactNode;
  onChange: (event: { target: { value: string } }) => void;
}) {
  // Do not ask flatpickr to parse incomplete keystrokes as complete dates.
  const calendarValue = useRef("");
  if (!value || parseCalendarDate(displayDate(value)))
    calendarValue.current = displayDate(value);
  const update = (text: string) => {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
    onChange({
      target: { value: match ? `${match[3]}-${match[2]}-${match[1]}` : text },
    });
  };
  return (
    <>
      <DatePicker
        className={styles.dateInput}
        datePickerType="single"
        dateFormat="d/m/Y"
        locale="es"
        parseDate={parseCalendarDate}
        value={calendarValue.current}
        minDate={min ? displayDate(min) : undefined}
        maxDate={max ? displayDate(max) : undefined}
        onChange={(_, text) => update(text)}
      >
        <DatePickerInput
          id={id}
          labelText={<>{labelText}</>}
          placeholder="DD/MM/AAAA"
          disabled={disabled}
          invalid={invalid}
          invalidText={<>{invalidText}</>}
          onChange={(event) => update(event.target.value)}
        />
      </DatePicker>
      {disabled && invalid && <FieldError message={invalidText} />}
    </>
  );
}
