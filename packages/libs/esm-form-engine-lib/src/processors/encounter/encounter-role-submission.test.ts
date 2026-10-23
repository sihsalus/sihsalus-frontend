import { EncounterProviderAdapter } from '../../adapters/encounter-provider-adapter';
import { EncounterRoleAdapter } from '../../adapters/encounter-role-adapter';
import { saveEncounter } from '../../api';
import { type FormContextProps } from '../../provider/form-provider';
import { DefaultFormSchemaTransformer } from '../../transformers/default-schema-transformer';
import { type FormField, type FormSchema, type OpenmrsEncounter } from '../../types';
import { EncounterFormProcessor } from './encounter-form-processor';

vi.mock('@openmrs/esm-framework', () => ({
  showSnackbar: vi.fn(),
  translateFrom: (_app: string, _key: string, fallback: string) => fallback,
}));
vi.mock('../../api', () => ({
  saveEncounter: vi.fn(async (_abort: unknown, encounter: OpenmrsEncounter) => ({
    data: encounter,
  })),
}));

// Same metadata-field shape as CE-SOC-001; all identities in this fixture are synthetic.
function createContext(extraFields: FormField[] = []): FormContextProps {
  const schema = DefaultFormSchemaTransformer.transform({
    name: 'Synthetic social history',
    uuid: 'synthetic-form',
    encounterType: 'synthetic-encounter-type',
    processor: 'EncounterFormProcessor',
    referencedForms: [],
    pages: [
      {
        label: 'Social history',
        sections: [
          {
            label: 'Encounter details',
            isExpanded: 'true',
            questions: [
              {
                id: 'professional',
                label: 'Professional',
                type: 'encounterProvider',
                required: true,
                questionOptions: { rendering: 'ui-select-extended' },
              },
              ...extraFields,
            ],
          },
        ],
      },
    ],
  } as FormSchema);
  const processor = new EncounterFormProcessor(schema);
  processor.prepareFormSchema(schema);
  return {
    processor,
    formJson: schema,
    patient: { id: 'synthetic-patient' },
    currentProvider: { uuid: 'synthetic-provider' },
    location: { uuid: 'synthetic-location' },
    visit: { uuid: 'synthetic-visit' },
    sessionDate: new Date('2026-10-23T15:00:00Z'),
    sessionMode: 'enter',
    formFields: schema.pages.flatMap((page) => page.sections.flatMap((section) => section.questions)),
    deletedFields: [],
    customDependencies: undefined, // QLTY: no generic Clinician role.
  } as FormContextProps;
}

describe('encounter role submission for schemas without an encounter role (#409)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('offers a required catalog selection and sends the selected role with the provider', async () => {
    const context = createContext();
    const role = context.formFields.find((field) => field.type === 'encounterRole');
    expect(role).toMatchObject({
      required: true,
      questionOptions: { rendering: 'encounter-role', isSearchable: false },
    });
    expect(EncounterRoleAdapter.getInitialValue(role, {} as never, context)).toBeUndefined();

    await expect(context.processor.processSubmission(context, new AbortController())).rejects.toMatchObject({
      descriptor: { title: 'Select the professional’s role in this encounter' },
    });
    expect(saveEncounter).not.toHaveBeenCalled();
    EncounterRoleAdapter.transformFieldValue(role, 'synthetic-medical-role', context);
    await context.processor.processSubmission(context, new AbortController());
    expect(saveEncounter).toHaveBeenCalledWith(
      expect.any(AbortController),
      expect.objectContaining({
        patient: 'synthetic-patient',
        form: { uuid: 'synthetic-form' },
        visit: 'synthetic-visit',
        encounterProviders: [
          {
            provider: 'synthetic-provider',
            encounterRole: 'synthetic-medical-role',
          },
        ],
      }),
      undefined,
    );
  });

  it('does not duplicate or replace an explicitly configured role field (CRED)', () => {
    const context = createContext([
      {
        id: 'credRole',
        type: 'encounterRole',
        required: true,
        questionOptions: {
          rendering: 'ui-select-extended',
          isSearchable: false,
        },
      },
    ]);
    context.processor.prepareFormSchema(context.formJson);
    const fields = context.formJson.pages.flatMap((page) => page.sections.flatMap((section) => section.questions));
    expect(fields.filter((field) => field.type === 'encounterRole').map((field) => field.id)).toEqual(['credRole']);
  });

  it('preserves the encounter, visit and provider-role association when reopening and saving', async () => {
    const context = createContext();
    const original = {
      uuid: 'synthetic-encounter',
      patient: { uuid: 'synthetic-patient' },
      form: { uuid: 'synthetic-form' },
      visit: { uuid: 'synthetic-visit' },
      encounterProviders: [
        {
          provider: { uuid: 'original-provider' },
          encounterRole: { uuid: 'original-role' },
        },
      ],
    };
    context.sessionMode = 'edit';
    context.formJson.encounter = original.uuid;
    context.domainObjectValue = original as never;
    const role = context.formFields.find((field) => field.type === 'encounterRole');
    const provider = context.formFields.find((field) => field.type === 'encounterProvider');
    EncounterRoleAdapter.transformFieldValue(
      role,
      EncounterRoleAdapter.getInitialValue(role, original as never, context),
      context,
    );
    EncounterProviderAdapter.transformFieldValue(
      provider,
      EncounterProviderAdapter.getInitialValue(provider, original as never, context),
      context,
    );
    await context.processor.processSubmission(context, new AbortController());
    expect(saveEncounter).toHaveBeenCalledWith(
      expect.any(AbortController),
      expect.objectContaining({
        uuid: original.uuid,
        visit: 'synthetic-visit',
        encounterProviders: original.encounterProviders,
      }),
      original.uuid,
    );
    expect(original.encounterProviders).toHaveLength(1);
  });

  it('does not copy another provider’s role when the schema uses the current session provider', () => {
    const context = createContext();
    context.formFields = context.formFields.filter((field) => field.type !== 'encounterProvider');
    const role = context.formFields[0];
    const original = {
      encounterProviders: [
        {
          provider: { uuid: 'another-provider' },
          encounterRole: { uuid: 'another-role' },
        },
      ],
    };
    expect(EncounterRoleAdapter.getInitialValue(role, original as never, context)).toBeUndefined();
  });

  it.each(['synthetic-provider', 'another-provider'])(
    'preserves previous associations when adding a role for %s',
    async (providerUuid) => {
      const context = createContext();
      const originalProviders = [{ provider: 'synthetic-provider', encounterRole: 'original-role' }];
      context.sessionMode = 'edit';
      context.formJson.encounter = 'synthetic-encounter';
      context.domainObjectValue = {
        uuid: 'synthetic-encounter',
        encounterProviders: originalProviders,
        patient: { uuid: 'synthetic-patient' },
        form: { uuid: 'synthetic-form' },
        visit: { uuid: 'synthetic-visit' },
      } as never;
      const role = context.formFields.find((field) => field.type === 'encounterRole');
      const provider = context.formFields.find((field) => field.type === 'encounterProvider');
      EncounterRoleAdapter.transformFieldValue(role, 'selected-role', context);
      EncounterProviderAdapter.transformFieldValue(provider, providerUuid, context);
      await context.processor.processSubmission(context, new AbortController());
      expect(saveEncounter).toHaveBeenCalledWith(
        expect.any(AbortController),
        expect.objectContaining({
          encounterProviders: [...originalProviders, { provider: providerUuid, encounterRole: 'selected-role' }],
        }),
        'synthetic-encounter',
      );
      expect(originalProviders).toEqual([{ provider: 'synthetic-provider', encounterRole: 'original-role' }]);
    },
  );

  it('uses an available generic default in a new form, with no previous encounter attribution', () => {
    const context = createContext();
    context.customDependencies = {
      defaultEncounterRole: { uuid: 'generic-clinician' },
    };
    const role = context.formFields.find((field) => field.type === 'encounterRole');
    expect(EncounterRoleAdapter.getInitialValue(role, {} as never, context)).toBe('generic-clinician');
  });

  it.each(['view', 'embedded-view'] as const)('displays the recorded role in %s without a provider field', (mode) => {
    const context = createContext();
    context.sessionMode = mode;
    context.formFields = context.formFields.filter((field) => field.type !== 'encounterProvider');
    const role = context.formFields[0];
    const original = {
      encounterProviders: [
        {
          provider: { uuid: 'another-provider' },
          encounterRole: { uuid: 'recorded-role' },
        },
      ],
    };
    expect(EncounterRoleAdapter.getInitialValue(role, original as never, context)).toBe('recorded-role');
  });
});
