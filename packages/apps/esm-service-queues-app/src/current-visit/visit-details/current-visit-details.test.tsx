import { useConfig, useSession } from "@openmrs/esm-framework";
import { render, screen } from "@testing-library/react";
import { mockSession } from "test-utils";
import { visitNotesViewPrivilege, vitalsPrivilege } from "../../constants";
import CurrentVisitDetails from "./current-visit-details.component";

const mockUseConfig = vi.mocked(useConfig);
const mockUseSession = vi.mocked(useSession);
const privilege = (name: string) => ({
  uuid: `privilege-${name}`,
  display: name,
  name,
  links: [],
});

vi.mock("../hooks/useVitalsConceptMetadata", () => ({
  useVitalsFromObs: vi.fn(() => []),
}));

vi.mock("./visit-note.component", () => ({
  default: ({ diagnoses }: { diagnoses: Array<{ diagnosis: string }> }) => (
    <div>
      Clinical visit summary
      {diagnoses.map(({ diagnosis }) => (
        <span key={diagnosis}>{diagnosis}</span>
      ))}
    </div>
  ),
}));

vi.mock("./vitals.component", () => ({
  default: () => <div>Patient vitals</div>,
}));

describe("CurrentVisitDetails", () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      concepts: {
        generalPatientNoteConceptUuid: "general-note",
        problemListConceptUuid: "problem-list",
        visitDiagnosesConceptUuid: "visit-diagnoses",
      },
      visitNoteEncounterTypeUuid: "visit-note-encounter",
    });
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      user: {
        ...mockSession.data.user,
        privileges: [
          ...mockSession.data.user.privileges,
          privilege(visitNotesViewPrivilege),
          privilege(vitalsPrivilege),
        ],
      },
    } as ReturnType<typeof useSession>);
  });

  it("shows clinical sections when their privileges are present", () => {
    render(<CurrentVisitDetails encounters={[]} patientUuid="patient-uuid" />);

    expect(screen.getByText("Clinical visit summary")).toBeInTheDocument();
    expect(screen.getByText("Patient vitals")).toBeInTheDocument();
  });

  it("shows active structured EncounterDiagnoses and ignores voided diagnoses", () => {
    render(
      <CurrentVisitDetails
        patientUuid="patient-uuid"
        encounters={[
          {
            uuid: "encounter-uuid",
            encounterDatetime: "2026-08-23T10:00:00.000-0500",
            encounterType: {
              uuid: "visit-note-encounter",
              display: "Visit Note",
            },
            encounterProviders: [],
            diagnoses: [
              {
                uuid: "diagnosis-active",
                display: "J00 - Rinofaringitis aguda",
                voided: false,
                diagnosis: {
                  coded: {
                    uuid: "cie10-j00",
                    display: "J00 - Rinofaringitis aguda",
                  },
                },
              },
              {
                uuid: "diagnosis-voided",
                display: "Diagnóstico anulado",
                voided: true,
                diagnosis: {
                  coded: { uuid: "cie10-old", display: "Diagnóstico anulado" },
                },
              },
            ],
            obs: [],
            orders: [],
          } as never,
        ]}
      />,
    );

    expect(screen.getByText("J00 - Rinofaringitis aguda")).toBeInTheDocument();
    expect(screen.queryByText("Diagnóstico anulado")).not.toBeInTheDocument();
  });

  it("uses the legacy grouped diagnosis only when no structured diagnosis exists", () => {
    render(
      <CurrentVisitDetails
        patientUuid="patient-uuid"
        encounters={[
          {
            uuid: "encounter-legacy",
            encounterDatetime: "2026-08-23T09:00:00.000-0500",
            encounterType: {
              uuid: "visit-note-encounter",
              display: "Visit Note",
            },
            encounterProviders: [],
            diagnoses: [],
            obs: [
              {
                uuid: "legacy-group",
                concept: { uuid: "visit-diagnoses" },
                groupMembers: [
                  {
                    concept: { uuid: "problem-list" },
                    value: {
                      uuid: "legacy-cie10",
                      display: "Diagnóstico legacy",
                    },
                  },
                ],
              },
            ],
            orders: [],
          } as never,
        ]}
      />,
    );

    expect(screen.getByText("Diagnóstico legacy")).toBeInTheDocument();
  });

  it("hides the visit summary without its privilege while retaining authorized vitals", () => {
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      user: {
        ...mockSession.data.user,
        privileges: [privilege(vitalsPrivilege)],
        roles: [
          {
            display: "Any operational role",
            name: "Any operational role",
            uuid: "operational-role-uuid",
            links: [],
          },
        ],
      },
    });

    render(<CurrentVisitDetails encounters={[]} patientUuid="patient-uuid" />);

    expect(
      screen.queryByText("Clinical visit summary"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Patient vitals")).toBeInTheDocument();
  });

  it("hides vitals without their privilege while retaining the authorized visit summary", () => {
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      user: {
        ...mockSession.data.user,
        privileges: [privilege(visitNotesViewPrivilege)],
      },
    } as ReturnType<typeof useSession>);

    render(<CurrentVisitDetails encounters={[]} patientUuid="patient-uuid" />);

    expect(screen.getByText("Clinical visit summary")).toBeInTheDocument();
    expect(screen.queryByText("Patient vitals")).not.toBeInTheDocument();
  });
});
