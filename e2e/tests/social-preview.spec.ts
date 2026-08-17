import { expect, test } from '@playwright/test';
import { getSpaBaseUrl } from '../utils/e2e-urls';

const SOCIAL_PREVIEW_START = '<!-- SIHSALUS social preview -->';
const SOCIAL_PREVIEW_END = '<!-- /SIHSALUS social preview -->';
const SOCIAL_PREVIEW_IMAGE_FILE = 'sihsalus-share.png';

const requiredSocialPreviewTags = [
  '<meta name="description" content="',
  '<meta property="og:site_name" content="SIH.SALUS">',
  '<meta property="og:title" content="SIH.SALUS">',
  '<meta property="og:description" content="',
  '<meta property="og:type" content="website">',
  '<meta property="og:url" content="',
  '<meta property="og:image" content="',
  '<meta name="twitter:card" content="summary_large_image">',
  '<meta name="twitter:image" content="',
];

test.describe('Social preview (Open Graph/Twitter) del SPA publicado', () => {
  test.beforeEach(({ browserName: _browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'El contrato de metatags solo necesita un proyecto');
  });

  test('el index.html publicado expone los metatags de vista previa social', async ({ page }) => {
    const spaBaseUrl = getSpaBaseUrl();
    const response = await page.request.get(spaBaseUrl, { headers: { accept: 'text/html' } });
    expect(response.ok(), 'Se esperaba que el shell del SPA respondiera').toBeTruthy();
    const html = await response.text();

    test.skip(
      !html.includes(SOCIAL_PREVIEW_START),
      'La vista previa social solo se inyecta en el artefacto ensamblado (dist/spa); el dev server no la sirve',
    );

    expect(html.split(SOCIAL_PREVIEW_START), 'Debe existir exactamente un bloque de vista previa').toHaveLength(2);
    expect(html.split(SOCIAL_PREVIEW_END), 'Debe existir exactamente un cierre del bloque').toHaveLength(2);
    expect(html).toContain('<title>SIH.SALUS</title>');

    for (const requiredTag of requiredSocialPreviewTags) {
      expect(html, `Falta el metatag requerido: ${requiredTag}`).toContain(requiredTag);
    }

    const ogImageUrl = html.match(/<meta property="og:image" content="([^"]+)">/)?.[1];
    expect(ogImageUrl, 'og:image debe declarar una URL').toBeTruthy();
    expect(ogImageUrl).toContain(SOCIAL_PREVIEW_IMAGE_FILE);

    const resolvedImageUrl = new URL(ogImageUrl as string, spaBaseUrl).toString();
    const imageResponse = await page.request.get(resolvedImageUrl);
    expect(imageResponse.ok(), `La imagen social debe servirse: ${resolvedImageUrl}`).toBeTruthy();
    expect(imageResponse.headers()['content-type'] ?? '').toContain('image/png');
  });
});
