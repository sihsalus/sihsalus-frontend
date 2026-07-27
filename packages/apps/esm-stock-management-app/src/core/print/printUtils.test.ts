import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareSafePrintHtml, printDocument } from './printUtils';

describe('prepareSafePrintHtml', () => {
  it('keeps static stock content, layout, and embedded images', async () => {
    const result = await prepareSafePrintHtml(`
      <html>
        <head><title>Nota de ingreso &amp; salida</title></head>
        <body>
          <table class="table-data"><tr><td style="text-align: right">Amoxicilina</td></tr></table>
          <img src="data:image/png;base64,AAAA" alt="logo">
          <svg viewBox="0 0 10 10" aria-label="logo vectorial"><path d="M0 0h10v10z"></path></svg>
        </body>
      </html>
    `);

    expect(result).toContain('Nota de ingreso &amp; salida');
    expect(result).toContain('Amoxicilina');
    expect(result).toContain('data:image/png;base64,AAAA');
    expect(result).toContain('Content-Security-Policy');
    expect(result).toContain("script-src 'none'");
    expect(result).toContain('table-data');
    expect(result).toContain('viewBox="0 0 10 10"');
  });

  it('removes executable, interactive, and remote content from fields and SVG logos', async () => {
    const result = await prepareSafePrintHtml(`
      <html>
        <head>
          <title>Stock</title>
          <base href="https://attacker.example/">
          <script>alert(document.cookie)</script>
        </head>
        <body onload="alert(1)">
          <img src="https://attacker.example/pixel" onerror="alert(2)">
          <img src="data:image/svg+xml,&lt;svg onload='alert(3)'&gt;&lt;/svg&gt;">
          <form action="https://attacker.example/leak"><input name="stock"></form>
          <iframe src="https://attacker.example/"></iframe>
          <svg onload="alert(3)"><a href="https://attacker.example/"><text>leak</text></a></svg>
          <div style="background: url(https://attacker.example/style.png)">unsafe CSS</div>
          <style>@import "https://attacker.example/style.css";</style>
        </body>
      </html>
    `);

    expect(result).not.toMatch(/<script|<form|<input|<iframe|<base|<a\b|<style>@import/i);
    expect(result).not.toMatch(/onload=|onerror=|href=|action=|attacker\.example|data:image\/svg/i);
  });
});

describe('printDocument', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('severs the opener, navigates to sanitized HTML, prints, closes, and revokes the blob URL', async () => {
    const listeners = new Map<string, EventListener>();
    const targetWindow = {
      opener: window,
      addEventListener: vi.fn((name: string, listener: EventListener) => listeners.set(name, listener)),
      close: vi.fn(),
      location: { replace: vi.fn() },
      print: vi.fn(),
    } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(targetWindow);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:safe-stock-print');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    printDocument('<html><body><p>Stock</p><script>alert(1)</script></body></html>');
    await vi.runAllTimersAsync();

    expect(targetWindow.opener).toBeNull();
    expect(targetWindow.location.replace).toHaveBeenCalledWith('blob:safe-stock-print');

    listeners.get('load')?.(new Event('load'));
    expect(targetWindow.print).toHaveBeenCalledOnce();

    listeners.get('afterprint')?.(new Event('afterprint'));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:safe-stock-print');
    expect(targetWindow.close).toHaveBeenCalledOnce();
  });

  it('revokes the blob URL when the browser blocks the print window', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:blocked-stock-print');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    printDocument('<p>Stock</p>');
    await vi.runAllTimersAsync();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:blocked-stock-print');
  });
});
