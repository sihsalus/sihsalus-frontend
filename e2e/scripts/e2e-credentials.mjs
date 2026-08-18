/**
 * Credenciales para los scripts de verificación: acepta E2E_USERNAME/E2E_PASSWORD
 * (histórico de estos scripts) y cae a E2E_USER_ADMIN_USERNAME/E2E_USER_ADMIN_PASSWORD,
 * las variables que ya usa la suite Playwright, para que un mismo .env sirva para ambos.
 */
export function getE2ECredentials() {
  const username = process.env.E2E_USERNAME || process.env.E2E_USER_ADMIN_USERNAME;
  const password = process.env.E2E_PASSWORD || process.env.E2E_USER_ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'Se requieren credenciales: define E2E_USERNAME/E2E_PASSWORD o E2E_USER_ADMIN_USERNAME/E2E_USER_ADMIN_PASSWORD.',
    );
  }

  return { username, password };
}
