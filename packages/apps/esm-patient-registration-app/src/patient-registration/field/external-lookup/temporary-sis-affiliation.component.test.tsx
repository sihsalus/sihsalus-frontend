import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SIS_TEMPORARY_AFFILIATION_VERIFICATION_METHOD } from '@openmrs/esm-patient-common-lib';
import { useState } from 'react';

import { searchLocalIdentityByDocument } from '../../identity/identity-search.resource';
import type { FormValues, PatientIdentifierType } from '../../patient-registration.types';
import { PatientRegistrationContext, type PatientRegistrationContextProps } from '../../patient-registration-context';
import {
  peruInsuranceAccreditationActiveConceptUuid,
  peruInsuranceAccreditationCheckedAtAttributeTypeUuid,
  peruInsuranceAccreditationInactiveConceptUuid,
  peruInsuranceAccreditationNotConsultedConceptUuid,
  peruInsuranceAccreditationStatusAttributeTypeUuid,
  peruInsuranceCodeAttributeTypeUuid,
  peruInsuranceSisConceptUuid,
  peruInsuranceTypeAttributeTypeUuid,
  peruInsuranceVerificationMethodAttributeTypeUuid,
  peruSisTypeDescriptionAttributeTypeUuid,
  peruTemporaryAffiliationPatientIdentifierTypeUuid,
} from '../../peru-registration-config';
import {
  getTemporarySisCoverageState,
  peruTemporarySisSiasisVerificationMethod,
  TemporarySisAffiliationConfirmation,
} from './temporary-sis-affiliation.component';

vi.mock('../../identity/identity-search.resource', () => ({
  searchLocalIdentityByDocument: vi.fn(),
}));

const mockSearchLocalIdentityByDocument = vi.mocked(searchLocalIdentityByDocument);
const confirmButtonName = /confirm active sis for this e code|confirmar sis vigente para este código e/i;

const temporaryIdentifierType = {
  fieldName: 'afiliacionTemporalSis',
  format: '^E-[0-9]{8}$',
  identifierSources: [],
  isPrimary: false,
  name: 'Afiliación Temporal SIS',
  required: false,
  uniquenessBehavior: 'UNIQUE',
  uuid: peruTemporaryAffiliationPatientIdentifierTypeUuid,
} as PatientIdentifierType;

function buildValues({
  attributes = {},
  autoGeneration = false,
  identifierUuid,
  initialValue = '',
}: {
  attributes?: FormValues['attributes'];
  autoGeneration?: boolean;
  identifierUuid?: string;
  initialValue?: string;
} = {}) {
  return {
    attributes,
    identifiers: {
      afiliacionTemporalSis: {
        autoGeneration,
        identifierName: temporaryIdentifierType.name,
        identifierTypeUuid: peruTemporaryAffiliationPatientIdentifierTypeUuid,
        identifierUuid,
        identifierValue: 'E-41267525',
        initialValue,
        preferred: false,
        required: false,
        selectedSource: null,
      },
    },
  } as unknown as FormValues;
}

function TemporarySisHarness({
  inEditMode = false,
  initialValues = buildValues(),
  isOffline = false,
  onFieldValue,
}: {
  inEditMode?: boolean;
  initialValues?: FormValues;
  isOffline?: boolean;
  onFieldValue?: (field: string, value: unknown) => void;
}) {
  const [values, setValues] = useState(initialValues);
  const [, setRenderCount] = useState(0);
  const setFieldValue = (field: string, value: unknown) => {
    onFieldValue?.(field, value);
    if (!field.startsWith('attributes.')) {
      return;
    }

    const attributeUuid = field.slice('attributes.'.length);
    setValues((current) => ({
      ...current,
      attributes: {
        ...current.attributes,
        [attributeUuid]: value as string,
      },
    }));
  };

  const context = {
    currentPhoto: null,
    identifierTypes: [temporaryIdentifierType],
    inEditMode,
    initialFormValues: initialValues,
    isOffline,
    setCapturePhotoProps: vi.fn(),
    setFieldTouched: vi.fn(),
    setFieldValue,
    validationSchema: null,
    values,
  } as unknown as PatientRegistrationContextProps;

  return (
    <PatientRegistrationContext.Provider value={context}>
      <TemporarySisAffiliationConfirmation />
      <output data-testid="coverage-values">{JSON.stringify(values.attributes ?? {})}</output>
      <button type="button" onClick={() => setRenderCount((count) => count + 1)}>
        Simulate submit retry
      </button>
      <button type="button" onClick={() => setFieldValue(`attributes.${peruInsuranceTypeAttributeTypeUuid}`, 'other')}>
        Mutate payer
      </button>
      <button
        type="button"
        onClick={() => setFieldValue(`attributes.${peruInsuranceCodeAttributeTypeUuid}`, 'E-99999999')}
      >
        Mutate insurance code
      </button>
      <button
        type="button"
        onClick={() =>
          setFieldValue(
            `attributes.${peruInsuranceAccreditationStatusAttributeTypeUuid}`,
            peruInsuranceAccreditationInactiveConceptUuid,
          )
        }
      >
        Mutate status
      </button>
      <button
        type="button"
        onClick={() =>
          setFieldValue(
            `attributes.${peruInsuranceAccreditationCheckedAtAttributeTypeUuid}`,
            '2026-08-25T18:00:00.000Z',
          )
        }
      >
        Mutate checked at
      </button>
      <button
        type="button"
        onClick={() => setFieldValue(`attributes.${peruInsuranceVerificationMethodAttributeTypeUuid}`, 'setisis')}
      >
        Mutate method
      </button>
    </PatientRegistrationContext.Provider>
  );
}

function getCoverageValues() {
  return JSON.parse(screen.getByTestId('coverage-values').textContent ?? '{}') as Record<string, string>;
}

describe('TemporarySisAffiliationConfirmation', () => {
  beforeEach(() => {
    mockSearchLocalIdentityByDocument.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not infer SIS coverage from a manually typed E code before explicit confirmation', () => {
    const onFieldValue = vi.fn();
    render(<TemporarySisHarness onFieldValue={onFieldValue} />);

    expect(screen.getByRole('button', { name: confirmButtonName })).toBeEnabled();
    expect(getCoverageValues()).toEqual({});
    expect(onFieldValue).not.toHaveBeenCalled();
    expect(mockSearchLocalIdentityByDocument).not.toHaveBeenCalled();
  });

  it.each([
    'manual-web',
    'setisis',
    peruTemporarySisSiasisVerificationMethod,
  ])('recognizes complete existing SIS evidence from %s without renewing its timestamp', (method) => {
    const checkedAt = '2026-08-25T15:30:00.123Z';
    expect(
      getTemporarySisCoverageState(
        {
          [peruInsuranceTypeAttributeTypeUuid]: peruInsuranceSisConceptUuid,
          [peruInsuranceCodeAttributeTypeUuid]: ' E-41267525 ',
          [peruInsuranceAccreditationStatusAttributeTypeUuid]: peruInsuranceAccreditationActiveConceptUuid,
          [peruInsuranceAccreditationCheckedAtAttributeTypeUuid]: checkedAt,
          [peruInsuranceVerificationMethodAttributeTypeUuid]: method,
        },
        'E-41267525',
      ),
    ).toBe('already-recorded');
  });

  it.each([
    ['raw digits', '41267525', '2026-08-25T15:30:00.123Z', 'siasis-adt'],
    ['SIS prefix', 'SIS-41267525', '2026-08-25T15:30:00.123Z', 'siasis-adt'],
    ['missing checkedAt', 'E-41267525', '', 'siasis-adt'],
    ['invalid checkedAt', 'E-41267525', '25/08/2026 15:30', 'siasis-adt'],
    ['missing source', 'E-41267525', '2026-08-25T15:30:00.123Z', ''],
    ['SITEDS source', 'E-41267525', '2026-08-25T15:30:00.123Z', 'siteds'],
    ['unknown source', 'E-41267525', '2026-08-25T15:30:00.123Z', 'typed-by-operator'],
  ])('treats %s as conflicting rather than as existing current evidence', (_caseName, code, checkedAt, method) => {
    expect(
      getTemporarySisCoverageState(
        {
          [peruInsuranceTypeAttributeTypeUuid]: peruInsuranceSisConceptUuid,
          [peruInsuranceCodeAttributeTypeUuid]: code,
          [peruInsuranceAccreditationStatusAttributeTypeUuid]: peruInsuranceAccreditationActiveConceptUuid,
          [peruInsuranceAccreditationCheckedAtAttributeTypeUuid]: checkedAt,
          [peruInsuranceVerificationMethodAttributeTypeUuid]: method,
        },
        'E-41267525',
      ),
    ).toBe('conflict');
  });

  it('treats SIS product details without an affiliation code as orphaned coverage', () => {
    expect(
      getTemporarySisCoverageState(
        {
          [peruInsuranceTypeAttributeTypeUuid]: peruInsuranceSisConceptUuid,
          [peruInsuranceAccreditationStatusAttributeTypeUuid]: peruInsuranceAccreditationNotConsultedConceptUuid,
          [peruSisTypeDescriptionAttributeTypeUuid]: 'Synthetic SIS product',
        },
        'E-41267525',
      ),
    ).toBe('conflict');
  });

  it.each([
    ['legacy persisted', buildValues({ initialValue: 'E-41267525' })],
    [
      'imported/hydrated',
      buildValues({
        identifierUuid: 'imported-identifier-uuid',
        initialValue: 'E-41267525',
      }),
    ],
    ['auto-generated', buildValues({ autoGeneration: true })],
  ])('does not reinterpret a %s E code as a current SIASIS result', (_caseName, values) => {
    render(<TemporarySisHarness initialValues={values} />);

    expect(screen.queryByRole('button', { name: confirmButtonName })).not.toBeInTheDocument();
    expect(mockSearchLocalIdentityByDocument).not.toHaveBeenCalled();
    expect(getCoverageValues()).toEqual({});
  });

  it('offers explicit confirmation for a genuinely new E code added during demographic editing', async () => {
    const user = userEvent.setup();
    render(<TemporarySisHarness inEditMode />);

    await user.click(screen.getByRole('button', { name: confirmButtonName }));

    await waitFor(() =>
      expect(getCoverageValues()).toMatchObject({
        [peruInsuranceTypeAttributeTypeUuid]: peruInsuranceSisConceptUuid,
        [peruInsuranceCodeAttributeTypeUuid]: 'E-41267525',
        [peruInsuranceVerificationMethodAttributeTypeUuid]: 'siasis-adt',
      }),
    );
  });

  it('confirms a freshly issued E code without requiring DNI and writes the controlled SIS bundle', async () => {
    const user = userEvent.setup();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-08-25T15:30:00.000Z'));
    render(<TemporarySisHarness />);

    await user.click(screen.getByRole('button', { name: confirmButtonName }));

    await waitFor(() =>
      expect(getCoverageValues()).toMatchObject({
        [peruInsuranceTypeAttributeTypeUuid]: peruInsuranceSisConceptUuid,
        [peruInsuranceCodeAttributeTypeUuid]: 'E-41267525',
        [peruInsuranceAccreditationStatusAttributeTypeUuid]: peruInsuranceAccreditationActiveConceptUuid,
        [peruInsuranceAccreditationCheckedAtAttributeTypeUuid]: expect.stringMatching(/^2026-08-25T15:30:00\.\d{3}Z$/),
        [peruInsuranceVerificationMethodAttributeTypeUuid]: peruTemporarySisSiasisVerificationMethod,
      }),
    );
    expect(mockSearchLocalIdentityByDocument).toHaveBeenCalledWith(
      'E-41267525',
      expect.any(AbortController),
      {
        patientIdentifierTypeUuid: peruTemporaryAffiliationPatientIdentifierTypeUuid,
      },
      { requireFreshNetwork: true, signal: expect.any(AbortSignal) },
    );
    expect(peruTemporarySisSiasisVerificationMethod).toBe(SIS_TEMPORARY_AFFILIATION_VERIFICATION_METHOD);
  });

  it.each([
    ['payer', /mutate payer/i],
    ['insurance code', /mutate insurance code/i],
    ['status', /mutate status/i],
    ['checkedAt', /mutate checked at/i],
    ['method', /mutate method/i],
  ])('invalidates locally attested evidence when its %s changes', async (_field, mutationButtonName) => {
    const user = userEvent.setup();
    render(<TemporarySisHarness />);

    await user.click(screen.getByRole('button', { name: confirmButtonName }));
    await waitFor(() =>
      expect(getCoverageValues()).toMatchObject({
        [peruInsuranceAccreditationStatusAttributeTypeUuid]: peruInsuranceAccreditationActiveConceptUuid,
        [peruInsuranceVerificationMethodAttributeTypeUuid]: peruTemporarySisSiasisVerificationMethod,
      }),
    );
    const appliedCheckedAt = getCoverageValues()[peruInsuranceAccreditationCheckedAtAttributeTypeUuid];
    expect(appliedCheckedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    await user.click(screen.getByRole('button', { name: mutationButtonName }));

    await waitFor(() => {
      const coverage = getCoverageValues();
      expect(coverage[peruInsuranceAccreditationStatusAttributeTypeUuid]).toBe('');
      expect(coverage[peruInsuranceAccreditationCheckedAtAttributeTypeUuid]).toBe('');
      expect(coverage[peruInsuranceVerificationMethodAttributeTypeUuid]).toBe('');
    });
    expect(screen.queryByText(/sis vigente registrado con el código e confirmado/i)).not.toBeInTheDocument();
  });

  it('shows a new coverage conflict instead of retaining the local confirmation success', async () => {
    const user = userEvent.setup();
    render(<TemporarySisHarness />);

    await user.click(screen.getByRole('button', { name: confirmButtonName }));
    expect(
      await screen.findByText(/active sis coverage.*already recorded|cobertura sis vigente.*registrada/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /mutate payer/i }));

    expect(
      await screen.findByText(/incompatible coverage information already exists|cobertura incompatible/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/active sis coverage.*already recorded|cobertura sis vigente.*registrada/i),
    ).not.toBeInTheDocument();
  });

  it('does not overwrite incompatible coverage', () => {
    const onFieldValue = vi.fn();
    render(
      <TemporarySisHarness
        initialValues={buildValues({
          attributes: {
            [peruInsuranceTypeAttributeTypeUuid]: 'other-payer-concept-uuid',
            [peruInsuranceCodeAttributeTypeUuid]: 'OTHER-123',
          },
        })}
        onFieldValue={onFieldValue}
      />,
    );

    expect(
      screen.getByText(/incompatible coverage information already exists|cobertura incompatible/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: confirmButtonName })).not.toBeInTheDocument();
    expect(onFieldValue).not.toHaveBeenCalled();
    expect(mockSearchLocalIdentityByDocument).not.toHaveBeenCalled();
  });

  it('keeps confirmation disabled offline and does not apply coverage', async () => {
    const user = userEvent.setup();
    const onFieldValue = vi.fn();
    render(<TemporarySisHarness isOffline onFieldValue={onFieldValue} />);

    const confirmButton = screen.getByRole('button', {
      name: confirmButtonName,
    });
    expect(confirmButton).toBeDisabled();
    await user.click(confirmButton);

    expect(mockSearchLocalIdentityByDocument).not.toHaveBeenCalled();
    expect(onFieldValue).not.toHaveBeenCalled();
    expect(getCoverageValues()).toEqual({});
  });

  it('blocks application when the fresh duplicate check finds an existing record', async () => {
    const user = userEvent.setup();
    const onFieldValue = vi.fn();
    mockSearchLocalIdentityByDocument.mockResolvedValue([
      {
        kind: 'patient',
        uuid: 'existing-patient-uuid',
        display: 'Synthetic patient',
        identifier: 'E-41267525',
        identifierTypeUuid: peruTemporaryAffiliationPatientIdentifierTypeUuid,
      },
    ]);
    render(<TemporarySisHarness onFieldValue={onFieldValue} />);

    await user.click(screen.getByRole('button', { name: confirmButtonName }));

    expect(await screen.findByText(/e code already belongs|código e ya pertenece/i)).toBeInTheDocument();
    expect(onFieldValue).not.toHaveBeenCalled();
    expect(getCoverageValues()).toEqual({});
  });

  it('allows a failed duplicate check to retry and keeps checkedAt stable after the successful apply', async () => {
    const user = userEvent.setup();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-08-25T16:00:00.000Z'));
    mockSearchLocalIdentityByDocument.mockRejectedValueOnce(new Error('network unavailable')).mockResolvedValueOnce([]);
    render(<TemporarySisHarness />);

    await user.click(screen.getByRole('button', { name: confirmButtonName }));
    expect(await screen.findByText(/could not be checked|no se pudo comprobar/i)).toBeInTheDocument();
    expect(getCoverageValues()).toEqual({});

    await user.click(screen.getByRole('button', { name: confirmButtonName }));
    await waitFor(() =>
      expect(getCoverageValues()[peruInsuranceAccreditationCheckedAtAttributeTypeUuid]).toMatch(
        /^2026-08-25T16:00:00\.\d{3}Z$/,
      ),
    );
    const checkedAt = getCoverageValues()[peruInsuranceAccreditationCheckedAtAttributeTypeUuid];
    await user.click(screen.getByRole('button', { name: /simulate submit retry/i }));

    expect(getCoverageValues()[peruInsuranceAccreditationCheckedAtAttributeTypeUuid]).toBe(checkedAt);
    expect(mockSearchLocalIdentityByDocument).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: confirmButtonName })).not.toBeInTheDocument();
  });
});
