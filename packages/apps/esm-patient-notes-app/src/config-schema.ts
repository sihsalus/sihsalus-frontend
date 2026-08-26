import { Type } from "@openmrs/esm-framework";
import notesConfigSchema, {
  type VisitNoteConfigObject,
} from "./notes/visit-note-config-schema";

export const configSchema = {
  diagnosisConceptClass: {
    _type: Type.UUID,
    _default: "8d4918b0-c2cc-11de-8d13-0010c6dffd0f",
    _description: "The concept class UUID for diagnoses",
  },
  isPrimaryDiagnosisRequired: {
    _type: Type.Boolean,
    _default: true,
    _description:
      "Indicates whether a primary diagnosis is required when submitting a visit note",
  },
  prestacionalConceptSourceName: {
    _type: Type.String,
    _default: "Codigos Prestacionales,Códigos Prestacionales",
    _description:
      "Comma-separated display names of the ConvSet whose members are SIHSALUS prestacional codes imported from OCL",
  },
  cie10ReferenceUrl: {
    _type: Type.String,
    _default: "https://www.minsa.gob.pe/reunis/index.asp?niv=1&op=3",
    _description:
      "Official MINSA/REUNIS reference for the Peruvian CIE-10 catalog, including the spreadsheet and current additions or retirements",
  },
  prestacionalReferenceUrl: {
    _type: Type.String,
    _default:
      "https://www.gob.pe/institucion/sis/normas-legales/7772769-000002-2026-sis-grep",
    _description:
      "Official SIS reference for the current FUA prestational codes; override when the configured catalog follows a newer resolution",
  },
  stickyNoteConceptUuid: {
    _type: Type.ConceptUuid,
    _default: "165095AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    _description: "The concept UUID for storing sticky notes as observations",
  },
  visitNoteConfig: notesConfigSchema,
};

export interface ConfigObject {
  cie10ReferenceUrl: string;
  diagnosisConceptClass: string;
  isPrimaryDiagnosisRequired: boolean;
  prestacionalConceptSourceName: string;
  prestacionalReferenceUrl: string;
  stickyNoteConceptUuid: string;
  visitNoteConfig: VisitNoteConfigObject;
}
