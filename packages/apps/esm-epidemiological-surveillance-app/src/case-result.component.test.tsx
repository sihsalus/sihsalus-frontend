import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CaseResultView } from "./case-result.component";
import type { CaseResult } from "./types";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe("small component boundaries", () => {
  it("shows immediate, outbreak and warning notifications of a saved case", () => {
    render(
      <CaseResultView
        result={{
          uuid: "case",
          diagnosisConceptUuid: "dx",
          icd10: "",
          periodicity: "SEMANAL",
          deadlineDays: 7,
          replayed: false,
          immediateAlerts: ["IMMEDIATE"],
          outbreakAlerts: ["OUTBREAK"],
          warnings: ["WARNING"],
        } as CaseResult}
      />,
    );
    expect(document.body.textContent).toContain("IMMEDIATE");
    expect(document.body.textContent).toContain("OUTBREAK");
    expect(document.body.textContent).toContain("WARNING");
  });

});
