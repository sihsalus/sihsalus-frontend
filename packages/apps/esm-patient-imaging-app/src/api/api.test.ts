import { openmrsFetch } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import useSWR from 'swr';
import { StudyUploadError, uploadStudies, useOrthancConfigurations } from './api';

vi.mock('@openmrs/esm-framework', () => ({ restBaseUrl: '/ws/rest/v1', openmrsFetch: vi.fn() }));
vi.mock('swr', () => ({ default: vi.fn() }));

describe('DICOM upload acknowledgement', () => {
  const config = { id: 3, orthancBaseUrl: 'http://orthanc:8042' };
  const patient = 'synthetic-patient';
  const file = (name: string) => new File(['synthetic-dicom'], name);
  const acknowledgement = {
    ok: true,
    data: { id: 12, studyInstanceUID: '1.2.3', mrsPatientUuid: patient, orthancConfiguration: config },
  };
  beforeEach(() => vi.clearAllMocks());

  it('sends each file with its patient and waits for the confirmed association', async () => {
    vi.mocked(openmrsFetch).mockResolvedValue(acknowledgement as never);
    const controller = new AbortController();
    await uploadStudies([file('a.dcm'), file('b.DCM')], config, patient, controller);
    expect(openmrsFetch).toHaveBeenCalledTimes(2);
    for (const [, options] of vi.mocked(openmrsFetch).mock.calls) {
      expect(options.signal).toBe(controller.signal);
      expect(options.rejectOnAuthFailure).toBe(true);
      expect((options.body as FormData).get('patient')).toBe(patient);
      expect((options.body as FormData).get('configurationId')).toBe('3');
    }
  });

  it('does not classify a file as sent when cancellation happened before its request', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(uploadStudies([file('unsent.dcm')], config, patient, controller)).rejects.toMatchObject({
      completedFiles: [],
      failedIndex: 0,
      hasUncertainFile: false,
    });
    expect(openmrsFetch).not.toHaveBeenCalled();
  });

  it('preserves confirmed files and stops after an ambiguous failure without retrying', async () => {
    const files = [file('a.dcm'), file('b.dcm'), file('c.dcm')];
    vi.mocked(openmrsFetch)
      .mockResolvedValueOnce(acknowledgement as never)
      .mockRejectedValueOnce(new Error('connection lost'));
    await expect(uploadStudies(files, config, patient, new AbortController())).rejects.toMatchObject({
      name: 'StudyUploadError',
      completedFiles: [files[0]],
      failedIndex: 1,
    });
    expect(openmrsFetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    undefined,
    {},
    { ...acknowledgement.data, mrsPatientUuid: 'another-patient' },
    { ...acknowledgement.data, orthancConfiguration: { id: 4 } },
    { ...acknowledgement.data, id: 0 },
    { ...acknowledgement.data, studyInstanceUID: ' ' },
    { ...acknowledgement.data, studyInstanceUID: 123 },
  ])('does not treat an invalid HTTP 200 body as a successful association: %j', async (data) => {
    vi.mocked(openmrsFetch).mockResolvedValueOnce({ ok: true, data } as never);
    await expect(uploadStudies([file('a.dcm')], config, patient, new AbortController())).rejects.toBeInstanceOf(
      StudyUploadError,
    );
  });

  it.each([
    'study.zip',
    'study.ZIP',
    'document.pdf',
    '',
  ])('rejects unsupported files before any write: %s', async (name) => {
    await expect(uploadStudies([file(name)], config, patient, new AbortController())).rejects.toThrow();
    expect(openmrsFetch).not.toHaveBeenCalled();
  });

  it('rejects an oversized file before any write without allocating its contents', async () => {
    const oversized = file('oversized.dcm');
    Object.defineProperty(oversized, 'size', { value: 200000001 });
    await expect(uploadStudies([oversized], config, patient, new AbortController())).rejects.toThrow();
    expect(openmrsFetch).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, NaN])('rejects an invalid configuration ID: %s', async (id) => {
    await expect(uploadStudies([file('a.dcm')], { ...config, id }, patient, new AbortController())).rejects.toThrow();
    expect(openmrsFetch).not.toHaveBeenCalled();
  });

  it('rejects empty files and missing patient context before any write', async () => {
    await expect(uploadStudies([new File([], 'empty.dcm')], config, patient, new AbortController())).rejects.toThrow();
    await expect(uploadStudies([file('a.dcm')], config, '', new AbortController())).rejects.toThrow();
    expect(openmrsFetch).not.toHaveBeenCalled();
  });
});

describe('Orthanc configuration response boundary', () => {
  it.each([
    null,
    {},
    'unexpected',
    [null],
    [{ id: 1 }],
    [{ id: 0, orthancBaseUrl: 'http://orthanc:8042' }],
  ])('reports malformed configuration data without passing it to ComboBox: %j', (data) => {
    vi.mocked(useSWR).mockReturnValue({ data: { data }, mutate: vi.fn() } as never);
    const { result } = renderHook(useOrthancConfigurations);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('preserves a valid empty configuration list', () => {
    vi.mocked(useSWR).mockReturnValue({ data: { data: [] }, mutate: vi.fn() } as never);
    const { result } = renderHook(useOrthancConfigurations);
    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeUndefined();
  });
});
