import {
  launchWorkspace2,
  usePatient,
  useSession,
} from "@openmrs/esm-framework";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockPatient, mockSession } from "test-utils";
import {
  serviceQueuesVisitNotesWorkspace,
  visitNotesEditPrivilege,
} from "../../constants";
import VisitNote from "./visit-note.component";

const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockUsePatient = vi.mocked(usePatient);
const mockUseSession = vi.mocked(useSession);
const privilege = (name: string) => ({
  uuid: `privilege-${name}`,
  display: name,
  name,
  links: [],
});

const note = {
  concept: { uuid: "note-concept-uuid", display: "Clinical note" },
  note: "Clinical summary",
  provider: { name: "Test Provider", role: "Clinician" },
  time: "10:30",
};
const visitContext = {
  uuid: "visit-uuid",
  location: { uuid: "location-uuid", display: "UPSS Consulta Externa" },
} as never;

describe("VisitNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePatient.mockReturnValue({
      patient: mockPatient,
    } as unknown as ReturnType<typeof usePatient>);
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      user: {
        ...mockSession.data.user,
        privileges: [privilege(visitNotesEditPrivilege)],
      },
    } as ReturnType<typeof useSession>);
  });

  it("shows an existing note and offers the canonical summary editor", () => {
    render(
      <VisitNote
        diagnoses={[]}
        notes={[note]}
        patientUuid={mockPatient.id}
        visitContext={visitContext}
      />,
    );

    expect(screen.getByText("Clinical summary")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open visit summary" }),
    ).toBeInTheDocument();
  });

  it("does not report a structured diagnosis-only summary as incomplete", () => {
    render(
      <VisitNote
        diagnoses={[{ diagnosis: "J00 - Rinofaringitis aguda" }]}
        notes={[]}
        patientUuid={mockPatient.id}
        visitContext={visitContext}
      />,
    );

    expect(screen.getByText("J00 - Rinofaringitis aguda")).toBeInTheDocument();
    expect(
      screen.queryByText(/has not been completed/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open visit summary" }),
    ).toBeInTheDocument();
  });

  it("opens the note workspace with the section privilege", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      user: {
        ...mockSession.data.user,
        privileges: [privilege(visitNotesEditPrivilege)],
      },
    } as ReturnType<typeof useSession>);

    render(
      <VisitNote
        diagnoses={[]}
        notes={[]}
        patientUuid={mockPatient.id}
        visitContext={visitContext}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Open visit summary" }),
    );

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      serviceQueuesVisitNotesWorkspace,
      {},
      null,
      expect.objectContaining({
        patientUuid: mockPatient.id,
        visitContext,
        mutateVisitContext: null,
      }),
    );
  });
});
