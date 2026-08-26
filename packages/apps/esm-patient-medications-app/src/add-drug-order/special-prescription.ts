import { type Drug } from '@openmrs/esm-patient-common-lib';

/**
 * Narcotic and psychotropic substances that must be prescribed on a numbered special
 * prescription form ("receta especial") per D.S. N° 023-2001-SA (Reglamento de
 * Estupefacientes, Psicotrópicos y otras Sustancias Sujetas a Fiscalización Sanitaria),
 * lists II A, III A, III B and III C.
 *
 * Entries marked "as printed" preserve apparent typos from the official DIGEMID listing
 * so that drug dictionaries transcribed from either spelling still match.
 */
export const DEFAULT_SPECIAL_PRESCRIPTION_DRUG_NAMES: Array<string> = [
  // Lista II A (estupefacientes)
  'cocaína',
  'dextromoramida',
  'fentanilo',
  'levorfanol',
  'metadona',
  'morfina',
  'opio',
  'oxicodona',
  'petidina',
  'remifentanilo',
  'sufentanilo',
  'cannabis',
  'tetrahidrocannabinol',
  'tetrahidrocannabinoles',
  // Lista III A (psicotrópicos)
  'anfepramona',
  'benzfetamina',
  'catina',
  'dexanfetamina',
  'etilanfetamina',
  'fenetilina',
  'fenproporex',
  'levometanfetamina',
  'fentermina',
  'mefenorex',
  'mazindol',
  'metilfenidato',
  'pemolina',
  'zipeprol',
  // Lista III B (psicotrópicos)
  'alobarbital',
  'allobarbital', // as printed
  'amobarbital',
  'aprobarbital',
  'barbital',
  'buprenorfina',
  'butalbital',
  'ciclobarbital',
  'flunitrazepam',
  'glutetimida',
  'hexobarbital',
  'meprobamato',
  'metabarbital',
  'pentazocina',
  'pentobarbital',
  'secbutabarbital',
  'secobarbital',
  'vinilbital',
  'vinilvital', // as printed
  // Lista III C (psicotrópicos)
  'etclorvinol',
  'etclovinol', // as printed
  'etinamato',
  'fenobarbital',
  'glucotimida', // as printed
  'metilfenobarbital',
  'metiprilona',
  'metiprolina', // as printed
  'tiopental',
  'pipradol',
];

/**
 * Lowercases and strips diacritics so that, e.g., "Cocaína" and "cocaina" compare equal.
 */
function normalizeForMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function tokenize(text: string): Array<string> {
  return normalizeForMatch(text)
    .split(/[^a-z]+/)
    .filter(Boolean);
}

/**
 * Returns the first configured substance name whose words all appear as whole words in the
 * drug or concept display name, or null if none match. Whole-word matching keeps salts and
 * strengths matching ("Morfina clorhidrato 20 mg/mL" → "morfina") without false positives
 * from partial names ("Fenobarbital" never matches the separate "barbital" entry).
 */
export function findSpecialPrescriptionMatch(
  drug: Drug | null | undefined,
  substanceNames: Array<string>,
): string | null {
  if (!drug || substanceNames.length === 0) {
    return null;
  }

  const drugTokens = new Set(tokenize(`${drug.display ?? ''} ${drug.concept?.display ?? ''}`));
  if (drugTokens.size === 0) {
    return null;
  }

  return (
    substanceNames.find((name) => {
      const nameTokens = tokenize(name);
      return nameTokens.length > 0 && nameTokens.every((token) => drugTokens.has(token));
    }) ?? null
  );
}
