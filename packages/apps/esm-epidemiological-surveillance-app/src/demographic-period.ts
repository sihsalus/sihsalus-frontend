import { displayDate } from "./date-display";
import type { Catalogue } from "./types";

/** Axis keys are calendar dates, independent of the browser time zone. */
export function demographicPeriodLabel(
  value: { key: string; label: string },
  period: string,
  calendar: Catalogue["catalog"],
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.key)) return value.label;
  const date = new Date(`${value.key}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value.label;
  let year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  switch (period) {
    case "dia":
      return displayDate(value.key);
    case "mes":
      return `${year}-${String(month).padStart(2, "0")}`;
    case "trimestre":
      return `${year}-T${Math.ceil(month / 3)}`;
    case "semestre":
      return `${year}-${Math.ceil(month / 6)}`;
    case "anio":
      return String(year);
    case "semana": {
      const days = [
        "SUNDAY",
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
      ];
      const firstDay = days.indexOf(calendar.firstDayOfWeek ?? "SUNDAY");
      const minimumDays = calendar.minimalDaysInFirstWeek ?? 4;
      const firstWeek = (y: number) => {
        const january = new Date(Date.UTC(y, 0, 1));
        const offset = (january.getUTCDay() - firstDay + 7) % 7;
        return Date.UTC(y, 0, 1 - offset + (7 - offset < minimumDays ? 7 : 0));
      };
      if (date.getTime() < firstWeek(year)) year--;
      else if (date.getTime() >= firstWeek(year + 1)) year++;
      const week =
        Math.floor((date.getTime() - firstWeek(year)) / 604800000) + 1;
      return `${year}-S${String(week).padStart(2, "0")}`;
    }
    default:
      return value.label;
  }
}
