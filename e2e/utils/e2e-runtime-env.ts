const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireE2ERuntimeValue(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be configured before E2E tests run.`);
  }
  return value;
}

export function requireE2ERuntimeUuid(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const value = requireE2ERuntimeValue(name, env);
  if (!uuidPattern.test(value)) {
    throw new Error(`${name} must be a valid UUID before E2E tests run.`);
  }
  return value;
}
