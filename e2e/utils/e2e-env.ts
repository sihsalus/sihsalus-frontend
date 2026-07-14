const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getRequiredSyntheticUuid(variableName: string): string {
  const value = process.env[variableName]?.trim();
  if (!value) {
    throw new Error(`${variableName} is required and must identify synthetic non-production test data.`);
  }

  if (!uuidPattern.test(value) || value === '00000000-0000-0000-0000-000000000000') {
    throw new Error(`${variableName} must be a valid non-nil UUID for synthetic test data.`);
  }

  return value;
}
