import { openmrsFetch } from "@openmrs/esm-framework";
import { apiBase, read, safeError } from "./api";

export type OutbreakRuleType = "THRESHOLD" | "CONSECUTIVE" | "FOCUS_CASES";
export interface OutbreakRule {
  id: string;
  type: OutbreakRuleType;
  weeks?: number | null;
  percentile?: number | null;
  minimumCases?: number | null;
  origin?: string | null;
  focus?: string | null;
}
export const outbreakOrigins = [
  "AUTOCTONO",
  "IMPORTADO_NACIONAL",
  "IMPORTADO_INTERNACIONAL",
  "RECAIDA",
  "RECRUDESCENCIA",
  "INDUCIDO",
  "INTRODUCIDO",
] as const;
export const outbreakFocuses = ["ACTIVE", "RESIDUAL", "ELIMINATED"] as const;
export const getOutbreakRules = (signal?: AbortSignal) =>
  read<OutbreakRule[]>(`${apiBase}/configuration/outbreak-rules`, signal);
export async function saveOutbreakRules(rules: OutbreakRule[]) {
  try {
    return (
      await openmrsFetch<OutbreakRule[]>(
        `${apiBase}/configuration/outbreak-rules`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rules),
        },
      )
    ).data;
  } catch (error) {
    throw safeError(error);
  }
}
export function newOutbreakRule(
  id: string,
  type: OutbreakRuleType,
): OutbreakRule {
  return type === "FOCUS_CASES"
    ? { id, type, minimumCases: 0, origin: "AUTOCTONO", focus: "ELIMINATED" }
    : { id, type, percentile: 75, weeks: type === "THRESHOLD" ? 1 : 2 };
}
export function validOutbreakRules(rules: OutbreakRule[]) {
  return (
    rules.length > 0 &&
    new Set(rules.map((r) => r.id)).size === rules.length &&
    rules.every((rule) => {
      if (rule.type === "FOCUS_CASES")
        return (
          typeof rule.minimumCases === "number" &&
          Number.isInteger(rule.minimumCases) &&
          rule.minimumCases >= 0 &&
          rule.minimumCases < 2147483647 &&
          outbreakOrigins.some((value) => value === rule.origin) &&
          outbreakFocuses.some((value) => value === rule.focus)
        );
      return (
        ["THRESHOLD", "CONSECUTIVE"].includes(rule.type) &&
        typeof rule.percentile === "number" &&
        Number.isFinite(rule.percentile) &&
        rule.percentile >= 0 &&
        rule.percentile <= 100 &&
        typeof rule.weeks === "number" &&
        Number.isInteger(rule.weeks) &&
        rule.weeks >= 1 &&
        rule.weeks <= 53 &&
        (rule.type !== "THRESHOLD" || rule.weeks === 1)
      );
    })
  );
}
