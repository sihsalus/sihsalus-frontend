import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import { type ConfigObject, configSchema, getSafeHelpUrl } from '../../config-schema';
import ContactUs from './contact-us.component';
import Docs from './docs.component';
import ReleaseNotes from './release-notes.component';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);

describe('SIHSALUS help links', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema));
  });

  it('uses the LAN help portal defaults and opens links safely', () => {
    render(
      <>
        <ReleaseNotes />
        <Docs />
        <ContactUs />
      </>,
    );

    const expectedLinks = [
      ['Release notes', '/ayuda/novedades/'],
      ['Docs', '/ayuda/'],
      ['Help and support', '/ayuda/soporte/'],
    ] as const;

    expectedLinks.forEach(([name, href]) => {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  it('uses deployment-specific configured URLs', () => {
    mockUseConfig.mockReturnValue({
      releaseNotesUrl: 'https://docs.sihsalus.org/novedades/',
      documentationUrl: 'https://sihsalus.github.io/sihsalus-docs/',
      supportUrl: 'https://docs.sihsalus.org/soporte/',
    });

    render(
      <>
        <ReleaseNotes />
        <Docs />
        <ContactUs />
      </>,
    );

    expect(screen.getByRole('link', { name: 'Release notes' })).toHaveAttribute(
      'href',
      'https://docs.sihsalus.org/novedades/',
    );
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute(
      'href',
      'https://sihsalus.github.io/sihsalus-docs/',
    );
    expect(screen.getByRole('link', { name: 'Help and support' })).toHaveAttribute(
      'href',
      'https://docs.sihsalus.org/soporte/',
    );
  });

  it('hides menu items whose URL is blank', () => {
    mockUseConfig.mockReturnValue({
      releaseNotesUrl: '',
      documentationUrl: '   ',
      supportUrl: '',
    });

    const { container } = render(
      <>
        <ReleaseNotes />
        <Docs />
        <ContactUs />
      </>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,test',
    'http://docs.sihsalus.org/',
    '//evil.example/',
    '/other/',
  ])('rejects and hides the unsafe configured URL %s', (unsafeUrl) => {
    mockUseConfig.mockReturnValue({
      releaseNotesUrl: unsafeUrl,
      documentationUrl: unsafeUrl,
      supportUrl: unsafeUrl,
    });

    const { container } = render(
      <>
        <ReleaseNotes />
        <Docs />
        <ContactUs />
      </>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(getSafeHelpUrl(unsafeUrl)).toBeNull();
  });

  it('keeps blank URLs optional in the configuration contract', () => {
    expect(configSchema.releaseNotesUrl._validators[0]('')).toBeUndefined();
    expect(configSchema.documentationUrl._validators[0]('  ')).toBeUndefined();
    expect(configSchema.supportUrl._validators[0]('javascript:alert(1)')).toMatch(/approved SIHSALUS/i);
  });
});
