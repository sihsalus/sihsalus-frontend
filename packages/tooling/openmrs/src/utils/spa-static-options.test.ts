import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { describe, expect, it, vi } from 'vitest';

import { createSpaStaticOptions, isSpaIndexRequestPath, setSpaStaticAssetHeaders } from '../../spa-static-options';

describe('isSpaIndexRequestPath', () => {
  it('matches client-side routes under the configured SPA path', () => {
    expect(isSpaIndexRequestPath('/openmrs/spa', '/openmrs/spa')).toBe(true);
    expect(isSpaIndexRequestPath('/openmrs/spa/', '/openmrs/spa/')).toBe(true);
    expect(isSpaIndexRequestPath('/openmrs/spa/index.html', '/openmrs/spa')).toBe(true);
    expect(isSpaIndexRequestPath('/openmrs/spa/home', '/openmrs/spa')).toBe(true);
    expect(isSpaIndexRequestPath('/openmrs/spa/home/fua-request?dashboard=true', '/openmrs/spa')).toBe(true);
  });

  it('does not classify static assets or backend paths as SPA routes', () => {
    expect(isSpaIndexRequestPath('/openmrs/spa/login.avif', '/openmrs/spa')).toBe(false);
    expect(isSpaIndexRequestPath('/openmrs/spa/manifest.webmanifest', '/openmrs/spa')).toBe(false);
    expect(isSpaIndexRequestPath('/openmrs/spa/chunks/module.js?cache=1', '/openmrs/spa')).toBe(false);
    expect(isSpaIndexRequestPath('/openmrs/ws/rest/v1/session', '/openmrs/spa')).toBe(false);
  });
});

describe('createSpaStaticOptions', () => {
  it('sets the Safari-compatible AVIF MIME type case-insensitively', () => {
    const response = { setHeader: vi.fn() };

    setSpaStaticAssetHeaders(response as never, '/dist/spa/login.AVIF');

    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'image/avif');
  });

  it('preserves caller options and composes an existing header callback', () => {
    const configuredSetHeaders = vi.fn();
    const response = { setHeader: vi.fn() };
    const options = createSpaStaticOptions({ index: false, setHeaders: configuredSetHeaders });

    options.setHeaders(response as never, '/dist/spa/login.avif', {} as never);

    expect(options.index).toBe(false);
    expect(configuredSetHeaders).toHaveBeenCalledOnce();
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'image/avif');
  });

  it('lets Express infer content types for other assets', () => {
    const response = { setHeader: vi.fn() };

    setSpaStaticAssetHeaders(response as never, '/dist/spa/login.png');

    expect(response.setHeader).not.toHaveBeenCalled();
  });

  it('serves AVIF with the centralized MIME policy over HTTP', async () => {
    const assetDir = mkdtempSync(join(tmpdir(), 'sihsalus-spa-static-'));
    writeFileSync(join(assetDir, 'login.avif'), Buffer.from([0, 0, 0, 0]));

    const app = express();
    app.use('/openmrs/spa', express.static(assetDir, createSpaStaticOptions({ index: false })));
    const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
      const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer));
      listeningServer.once('error', reject);
    });

    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}/openmrs/spa/login.avif`, {
        headers: { connection: 'close' },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/avif');
      expect((await response.arrayBuffer()).byteLength).toBe(4);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      rmSync(assetDir, { recursive: true, force: true });
    }
  });
});
