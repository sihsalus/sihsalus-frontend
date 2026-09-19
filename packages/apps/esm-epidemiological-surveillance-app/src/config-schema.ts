import { Type } from "@openmrs/esm-framework";
export const configSchema = {
  defaultReportPeriod: {
    _type: Type.String,
    _default: "semana",
    _description: "Initial period: dia, semana, mes, trimestre or semestre.",
  },
  reportLookbackDays: {
    _type: Type.Number,
    _default: 28,
    _description: "Initial date range for the epidemiological dashboard.",
  },
};
/** Clinical UUIDs come from the verified OMOD metadata catalogue, never from component constants. */
export interface Config {
  defaultReportPeriod: string;
  reportLookbackDays: number;
}
