import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://localhost:53700/openmrs/spa';
const PATIENT = 'c214ac3e-17e8-4cba-a142-edcae9664a3c';
const SHOTS = '/tmp/verify-sihsalus/shots';
const USER = process.env.OMRS_USER ?? 'dr.mendoza';
const PASS = process.env.OMRS_PASS ?? 'Doctor123';

fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'es', ignoreHTTPSErrors: true });
const page = await ctx.newPage();

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
});
const failedPosts = [];
page.on('response', async (res) => {
  const req = res.request();
  if (req.method() === 'POST' && res.status() >= 400 && res.url().includes('/ws/rest/')) {
    let body = '';
    try {
      body = (await res.text()).slice(0, 600);
    } catch {}
    failedPosts.push({ url: res.url(), status: res.status(), body });
  }
});

async function shot(name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
  console.log(`SHOT ${name}`);
}

function log(msg) {
  console.log(`STEP ${msg}`);
}

try {
  // ---------- Login ----------
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox').first().fill(USER);
  await page.locator('input[type="password"]').fill(PASS);
  await page.getByRole('button', { name: /iniciar|log in/i }).click();
  log('credentials submitted');

  // Location picker (may be skipped if a default exists)
  try {
    const loc = page.getByText('UPSS - CONSULTA EXTERNA', { exact: false }).first();
    await loc.waitFor({ timeout: 15000 });
    await loc.click();
    await page.getByRole('button', { name: /confirm/i }).click();
    log('location selected: UPSS - CONSULTA EXTERNA');
  } catch {
    log('location picker not shown (default session location?)');
  }
  await page.waitForURL(/home|patient/, { timeout: 30000 });
  await shot('01-logged-in');

  // ---------- Flow A: vitals ----------
  await page.goto(`${BASE}/patient/${PATIENT}/chart/Patient%20summary`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Axel', { exact: false }).first().waitFor({ timeout: 40000 });
  log('patient chart loaded');
  await shot('02-chart');

  const recordVitals = page.getByText(/record vitals|registrar signos/i).first();
  await recordVitals.waitFor({ timeout: 30000 });
  await recordVitals.click();
  log('opened vitals workspace');

  const spin = (re) => page.getByRole('spinbutton', { name: re }).first();
  await spin(/temp/i).waitFor({ timeout: 30000 });
  await spin(/temp/i).fill('36.8');
  await spin(/systolic|sist/i).fill('120');
  await spin(/diastolic|diast/i).fill('80');
  await spin(/pulse|heart|cardiaca/i).fill('72');
  await spin(/respira/i).fill('16');
  await spin(/ox|satura/i).fill('98');
  await spin(/weight|peso/i).fill('70');
  await spin(/height|talla|estatura/i).fill('170');
  await shot('03-vitals-filled');

  await page.getByRole('button', { name: /save and close|guardar y cerrar/i }).click();
  log('vitals save clicked');

  const vitalsOk = page.getByText(/vitals and biometrics saved|signos vitales.*guardad/i).first();
  const vitalsErr = page.getByText(/active visit is required|error saving vitals|consulta activa/i).first();
  const vitalsResult = await Promise.race([
    vitalsOk.waitFor({ timeout: 30000 }).then(() => 'SAVED'),
    vitalsErr.waitFor({ timeout: 30000 }).then(() => 'ERROR'),
  ]);
  await shot('04-vitals-result');
  console.log(`RESULT vitals: ${vitalsResult}`);
  if (vitalsResult !== 'SAVED') throw new Error('Vitals save failed');

  // ---------- Flow B: drug order ----------
  await page.getByRole('button', { name: /order basket|canasta/i }).first().click();
  log('order basket opened');
  await page.getByText(/drug orders|medicamentos/i).first().waitFor({ timeout: 30000 });
  await shot('05-order-basket');

  // "Add +" button of the drug orders section (first Add in the basket)
  await page.getByRole('button', { name: /^add/i }).first().click();
  log('drug search opened');

  const search = page.getByPlaceholder(/search/i).first();
  await search.waitFor({ timeout: 30000 });
  await search.fill('ERGOMETRINA');
  const addBtn = page.getByRole('button', { name: /add to basket|agregar/i }).first();
  await addBtn.waitFor({ timeout: 30000 });
  await shot('06-drug-search');
  await addBtn.click();
  log('drug added to basket');

  // The drug order form may open automatically; otherwise the item is in the basket as incomplete.
  // Wait a moment and detect which screen we are on.
  await page.waitForTimeout(2000);
  const onForm = await page
    .getByRole('spinbutton', { name: /dose|dosis/i })
    .first()
    .isVisible()
    .catch(() => false);

  if (onForm) {
    log('drug order form opened; filling required fields');
    await page.getByRole('spinbutton', { name: /dose|dosis/i }).first().fill('1');
    // dose unit / route / frequency comboboxes
    const combos = page.getByRole('combobox');
    const fillCombo = async (re, option) => {
      const combo = page.getByRole('combobox', { name: re }).first();
      if (await combo.isVisible().catch(() => false)) {
        await combo.click();
        await page.getByRole('option').first().click();
      }
    };
    await fillCombo(/dose unit|unidad/i);
    await fillCombo(/route|v[ií]a/i);
    await fillCombo(/frequency|frecuencia/i);
    const qty = page.getByRole('spinbutton', { name: /quantity|cantidad/i }).first();
    if (await qty.isVisible().catch(() => false)) await qty.fill('1');
    const refills = page.getByRole('spinbutton', { name: /refill|recarga/i }).first();
    if (await refills.isVisible().catch(() => false)) await refills.fill('0');
    const indication = page.getByRole('textbox', { name: /indication|indicaci/i }).first();
    if (await indication.isVisible().catch(() => false)) await indication.fill('verificacion');
    await shot('07-drug-form');
    await page.getByRole('button', { name: /save order|guardar orden/i }).click();
    log('drug order form saved');
  } else {
    log('no drug order form detected; item should be in basket');
  }

  // Sign and close
  const signBtn = page.getByRole('button', { name: /sign and close|firmar/i }).first();
  await signBtn.waitFor({ timeout: 30000 });
  await shot('08-before-sign');
  await signBtn.click();
  log('sign and close clicked');

  const orderOk = page.getByText(/placed order|order(s)? (placed|saved)|orden(es)? (creada|guardada|registrada)/i).first();
  const orderErr = page
    .getByText(/date activated|try launching the workspace|error/i)
    .first();
  const orderResult = await Promise.race([
    orderOk.waitFor({ timeout: 40000 }).then(() => 'SIGNED'),
    orderErr.waitFor({ timeout: 40000 }).then(() => 'ERROR'),
  ]);
  await shot('09-order-result');
  console.log(`RESULT order: ${orderResult}`);
  if (orderResult !== 'SIGNED') throw new Error('Order sign failed');

  console.log('VERIFICATION OK');
} catch (err) {
  await shot('99-failure');
  console.error('VERIFICATION FAILED:', err.message);
  process.exitCode = 1;
} finally {
  if (failedPosts.length) {
    console.log('FAILED POSTS:', JSON.stringify(failedPosts, null, 2));
  }
  if (consoleErrors.length) {
    console.log('CONSOLE ERRORS (first 5):', JSON.stringify(consoleErrors.slice(0, 5), null, 2));
  }
  await browser.close();
}
