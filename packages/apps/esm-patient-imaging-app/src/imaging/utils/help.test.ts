import { modalityOptions } from '../../types';
import {
  buildLocalInstancePreviewUrl,
  buildOhifViewerUrl,
  generateAccessionNumber,
  getOrthancPublicRoot,
  toDicomDate,
  toDicomTimeString,
} from './help';

vi.mock('@openmrs/esm-framework', () => ({
  restBaseUrl: '/ws/rest/v1',
  makeUrl: (path: string) => window.openmrsBase + path,
}));

describe('DICOM worklist values', () => {
  it('keeps modality codes unique and every option named', () => {
    expect(new Set(modalityOptions.map(({ code }) => code)).size).toBe(modalityOptions.length);
    expect(modalityOptions.every(({ label }) => !!label)).toBe(true);
    expect(modalityOptions.find(({ code }) => code === 'NM')?.label).toContain('Nuclear');
  });

  it('uses DA8 for future dates, and SH16 for accession numbers', () => {
    expect(toDicomDate(new Date(2030, 0, 2))).toBe('20300102');
    expect(generateAccessionNumber()).toMatch(/^[A-F0-9]{16}$/);
    expect(() => toDicomDate(new Date('invalid'))).toThrow();
  });

  it.each([
    ['12:00', 'AM', '000000'],
    ['12:00', 'PM', '120000'],
    ['01:05', 'PM', '130500'],
    ['11:59', 'AM', '115900'],
  ] as const)('converts %s %s to TM', (time, period, expected) => {
    expect(toDicomTimeString(time, period)).toBe(expected);
  });

  it.each(['13:00', '00:01', '10:60', '1:5', '', 'NaN:12'])('rejects invalid time %s', (time) => {
    expect(() => toDicomTimeString(time, 'AM')).toThrow();
  });
});

describe('explicit imaging server mapping', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { origin: 'https://synthetic.example' });
    window.openmrsBase = '/openmrs';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('opens OHIF only for the proxy served by the local viewer', () => {
    const config = {
      id: 9,
      orthancBaseUrl: 'http://orthanc:8042',
      orthancProxyUrl: 'https://synthetic.example/orthanc/',
    };
    expect(buildOhifViewerUrl([{ code: 'StudyInstanceUIDs', value: '1.2.3' }], config)).toBe(
      'https://synthetic.example/imaging/viewer?StudyInstanceUIDs=1.2.3',
    );
    expect(buildOhifViewerUrl([], { ...config, orthancProxyUrl: 'https://another.example/orthanc' })).toBe('');
    expect(buildOhifViewerUrl([], { ...config, orthancProxyUrl: undefined })).toBe('');
  });

  it('preserves an explicit remote proxy instead of silently choosing a different PACS', () => {
    expect(
      getOrthancPublicRoot({
        id: 1,
        orthancBaseUrl: 'http://orthanc:8042',
        orthancProxyUrl: 'https://another.example/pacs',
      }),
    ).toBe('https://another.example/pacs');
  });

  it.each([
    'javascript:alert(1)',
    'https://user:password@synthetic.example/orthanc',
    'https://synthetic.example/orthanc?token=hidden',
    'invalid',
  ])('rejects unsafe or ambiguous proxy mappings', (orthancProxyUrl) => {
    expect(getOrthancPublicRoot({ id: 1, orthancBaseUrl: 'http://orthanc:8042', orthancProxyUrl })).toBe('');
  });

  it('preserves a non-default OpenMRS context path for previews', () => {
    window.openmrsBase = '/clinical';
    expect(buildLocalInstancePreviewUrl(7, 'instance')).toContain('/clinical/ws/rest/v1/imaging/previewinstance?');
  });

  it('uses the authenticated OpenMRS preview endpoint and escapes identifiers', () => {
    expect(buildLocalInstancePreviewUrl(7, 'instance&other=1')).toBe(
      'https://synthetic.example/openmrs/ws/rest/v1/imaging/previewinstance?orthancInstanceUID=instance%26other%3D1&studyId=7',
    );
  });
});
