/**
 * Script para capturar screenshots de los módulos funcionales:
 * - Módulo Salud Materna (prenatal, parto, postparto, planificación familiar, prevención cáncer)
 * - Módulo CRED / Cuidado del Niño Sano (controles, vacunación, nutrición, etc.)
 * - Ward App - Vista de Hospitalización Materna
 *
 * Uso:
 *   npx playwright test e2e/screenshots/capture-modules.ts --headed
 *   o
 *   npx ts-node e2e/screenshots/capture-modules.ts
 */

import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://gidis-hsc-dev.inf.pucp.edu.pe/openmrs/spa';
const USERNAME = 'admin';
const PASSWORD = 'Admin123';
// Pacientes de prueba obtenidos via API
const FEMALE_PATIENT_UUID = '19af6b94-7114-47ef-831d-cc63c8601d67'; // María Paola REYES ORTIZ
const CHILD_PATIENT_UUID = 'e222fb7f-9dad-4c2c-8b2b-98b79699e33c'; // María Beatriz RAMOS CHOQUE

const OUTPUT_DIR = path.join(__dirname, 'output');

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'es-PE',
  });
  const page = await context.newPage();

  // ── 1. Login ────────────────────────────────────────────────────────────────
  console.log('Iniciando sesión...');
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('#username', { timeout: 30_000 });
  await page.fill('#username', USERNAME);
  await page.click('button[type="submit"]');
  await page.waitForSelector('#password', { timeout: 10_000 });
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');

  // Seleccionar ubicación si aparece
  try {
    await page.waitForSelector('[data-testid="location-picker"], .location-picker, input[name="location"]', {
      timeout: 8_000,
    });
    // Intentar seleccionar primera ubicación disponible
    const firstLocation = page.locator('ul li button, .location-card').first();
    if (await firstLocation.isVisible()) {
      await firstLocation.click();
    }
    const confirmBtn = page.locator('button:has-text("Confirmar"), button:has-text("Confirm")');
    if (await confirmBtn.isVisible({ timeout: 3_000 })) {
      await confirmBtn.click();
    }
  } catch {
    // Sin selector de ubicación
  }

  await page.waitForURL(/\/home/, { timeout: 30_000 });
  console.log('Login exitoso.');

  // ── 2. Home Page ─────────────────────────────────────────────────────────────
  await page.waitForLoadState('networkidle');
  await page.screenshot({
    path: path.join(OUTPUT_DIR, '00-home.png'),
    fullPage: false,
  });
  console.log('Screenshot: Home');

  // Helper para navegar al chart de un paciente
  async function goToPatientChart(patientUuid: string) {
    await page.goto(`${BASE_URL}/patient/${patientUuid}/chart/Patient Summary`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
  }

  // Helper screenshot
  async function shot(name: string) {
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${name}.png`), fullPage: false });
    console.log(`Screenshot: ${name}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MÓDULO SALUD MATERNA
  // ─────────────────────────────────────────────────────────────────────────────

  await goToPatientChart(FEMALE_PATIENT_UUID);
  await shot('01-salud-materna-resumen-paciente');

  // Navegar al grupo Salud Materna en el sidebar
  const maternalGroupLink = page
    .locator('a:has-text("Salud Materna"), a:has-text("Maternal"), nav >> text=Salud Materna')
    .first();

  if (await maternalGroupLink.isVisible({ timeout: 5_000 })) {
    await maternalGroupLink.click();
    await shot('02-salud-materna-grupo');
  }

  // Sub-módulos de Salud Materna
  const maternalSubModules: Array<{ label: string; keywords: string[] }> = [
    { label: '03-prenatal', keywords: ['Prenatal', 'Control Prenatal', 'Atención Prenatal'] },
    { label: '04-parto-puerperio', keywords: ['Parto', 'Labor', 'Labour', 'Puerperio', 'Postparto'] },
    { label: '05-planificacion-familiar', keywords: ['Planificación', 'Family Planning', 'Planificacion'] },
    { label: '06-prevencion-cancer', keywords: ['Cáncer', 'Cancer', 'Prevención'] },
  ];

  for (const mod of maternalSubModules) {
    let found = false;
    for (const kw of mod.keywords) {
      const link = page.locator(`nav a:has-text("${kw}"), [data-testid*="dashboard"] a:has-text("${kw}")`).first();
      if (await link.isVisible({ timeout: 3_000 })) {
        await link.click();
        await page.waitForLoadState('networkidle');
        await shot(mod.label);
        found = true;
        break;
      }
    }
    if (!found) {
      // Intentar via URL directa
      const urlPaths: Record<string, string> = {
        '03-prenatal': 'prenatal-care-dashboard',
        '04-parto-puerperio': 'labour-and-delivery-dashboard',
        '05-planificacion-familiar': 'family-planning-dashboard',
        '06-prevencion-cancer': 'cancer-prevention-dashboard',
      };
      const dashPath = urlPaths[mod.label];
      if (dashPath) {
        await page.goto(`${BASE_URL}/patient/${FEMALE_PATIENT_UUID}/chart/${dashPath}`, {
          waitUntil: 'domcontentloaded',
        });
        await page.waitForLoadState('networkidle');
        await shot(mod.label);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MÓDULO CRED (Crecimiento y Desarrollo)
  // ─────────────────────────────────────────────────────────────────────────────

  await goToPatientChart(CHILD_PATIENT_UUID);
  await shot('07-cred-resumen-paciente');

  const credSubModules: Array<{ label: string; urlPath: string }> = [
    { label: '08-cred-controles', urlPath: 'cred-dashboard' },
    { label: '09-cred-vacunacion', urlPath: 'child-immunization-schedule-dashboard' },
    { label: '10-cred-atencion-neonatal', urlPath: 'neonatal-care-dashboard' },
    { label: '11-cred-cuidado-nino-sano', urlPath: 'well-child-care-dashboard' },
  ];

  for (const mod of credSubModules) {
    await page.goto(`${BASE_URL}/patient/${CHILD_PATIENT_UUID}/chart/${mod.urlPath}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle');
    await shot(mod.label);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MÓDULO WARD - Hospitalización Materna
  // ─────────────────────────────────────────────────────────────────────────────

  await page.goto(`${BASE_URL}/maternal-ward`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await shot('12-ward-hospitalizacion-materna');

  // Vistas alternativas del ward
  const wardPaths = ['ward', 'bed-management', 'maternal-ward'];
  for (const wp of wardPaths) {
    await page.goto(`${BASE_URL}/${wp}`, { waitUntil: 'domcontentloaded' });
    if (!page.url().includes('login')) {
      await page.waitForLoadState('networkidle');
      await shot(`13-ward-${wp}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MÓDULO ATENCIÓN AMBULATORIA / COLA DE ESPERA
  // ─────────────────────────────────────────────────────────────────────────────

  await page.goto(`${BASE_URL}/service-queues`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await shot('14-cola-atencion');

  // ─────────────────────────────────────────────────────────────────────────────
  // Módulo de Visitas Activas
  // ─────────────────────────────────────────────────────────────────────────────

  await page.goto(`${BASE_URL}/active-visits`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await shot('15-visitas-activas');

  // ─────────────────────────────────────────────────────────────────────────────
  // Home con navegación principal visible
  // ─────────────────────────────────────────────────────────────────────────────

  await page.goto(`${BASE_URL}/home`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await shot('16-home-navegacion-principal');

  await browser.close();
  console.log(`\n✓ Screenshots guardados en: ${OUTPUT_DIR}`);
}

main().catch(console.error);
