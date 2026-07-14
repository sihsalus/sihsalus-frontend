// @vitest-environment jsdom

import { createInertFuaHtml, resolveTrustedFuaEndpoint } from './fua-html-security';

describe('FUA HTML security', () => {
  describe('resolveTrustedFuaEndpoint', () => {
    it('accepts an HTTPS endpoint routed through the application origin', () => {
      expect(resolveTrustedFuaEndpoint('/services/fua-generator', 'https://hce.example.org')?.toString()).toBe(
        'https://hce.example.org/services/fua-generator',
      );
    });

    it.each([
      ['', 'https://hce.example.org'],
      ['https://generator.example.net/fua', 'https://hce.example.org'],
      ['http://hce.example.org/fua', 'http://hce.example.org'],
      ['https://user:password@hce.example.org/fua', 'https://hce.example.org'],
      ['https://hce.example.org/fua#patient', 'https://hce.example.org'],
    ])('rejects an absent or untrusted endpoint', (endpoint, applicationOrigin) => {
      expect(resolveTrustedFuaEndpoint(endpoint, applicationOrigin)).toBeNull();
    });

    it('allows same-origin loopback HTTP only for local development', () => {
      expect(resolveTrustedFuaEndpoint('/fua', 'http://localhost:8080')?.origin).toBe('http://localhost:8080');
    });
  });

  it('turns remote HTML into a static, network-inert document', () => {
    const html = createInertFuaHtml(`
      <html>
        <head><meta http-equiv="refresh" content="0; https://attacker.example"><script>alert(1)</script></head>
        <body onload="steal()">
          <form action="https://attacker.example"><strong>FUA 123</strong></form>
          <a href="https://attacker.example/clinical-data">send</a>
          <img src="https://attacker.example/pixel">
          <img src="data:image/png;base64,AAAA">
          <iframe src="https://attacker.example"></iframe>
        </body>
      </html>
    `);

    const document = new DOMParser().parseFromString(html, 'text/html');
    const images = document.querySelectorAll('img');

    expect(document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content')).toContain(
      "default-src 'none'",
    );
    expect(document.querySelector('script, form, iframe, meta[http-equiv="refresh"]')).toBeNull();
    expect(document.body.textContent).toContain('FUA 123');
    expect(document.body.getAttribute('onload')).toBeNull();
    expect(document.querySelector('a')?.getAttribute('href')).toBeNull();
    expect(images[0].getAttribute('src')).toBeNull();
    expect(images[1].getAttribute('src')).toBe('data:image/png;base64,AAAA');
  });
});
