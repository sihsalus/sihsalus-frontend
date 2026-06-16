import type { Session } from '@openmrs/esm-framework';
import omit from 'lodash-es/omit';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import type { ConfigObject } from '../config-schema';
import { relationshipFormSchema, saveRelationship } from '../relationships/relationship.resources';
import type { Enrollment, HTSEncounter } from '../types';

export const BOOLEAN_YES = 'f7e458ef-8dea-4e53-b429-81664cbeda49';
export const BOOLEAN_NO = '17455a61-ab7d-4bfb-a8d2-68f75a10d5f0';
export const IPV_OUTCOME_POSITIVE = 'b4454bf6-5e67-4235-9507-6875d784656d';
export const IPV_OUTCOME_NEGATIVE = '707bd07e-7d27-4571-ad92-ec419af1a0f4';

// Custom hook to create schema with translations
export const useContactListFormSchema = () => {
  const { t } = useTranslation();

  return relationshipFormSchema
    .extend({
      physicalAssault: z.enum([BOOLEAN_YES, BOOLEAN_NO]).optional(),
      threatened: z.enum([BOOLEAN_YES, BOOLEAN_NO]).optional(),
      sexualAssault: z.enum([BOOLEAN_YES, BOOLEAN_NO]).optional(),
      livingWithClient: z.string().optional(),
      baselineStatus: z.string().optional(),
      preferedPNSAproach: z.string().optional(),
      ipvOutcome: z.enum([IPV_OUTCOME_POSITIVE, IPV_OUTCOME_NEGATIVE]).optional(),
      dataConsent: z.boolean().refine((v) => v === true, {
        message: t(
          'dataConsentRequired',
          'Se requiere el consentimiento del titular para registrar sus datos de salud (Ley 29733)',
        ),
      }),
    })
    .refine(
      (data) => {
        return !(data.mode === 'search' && !data.personB);
      },
      {
        message: t('required', 'Requerido'),
        path: ['personB'],
      },
    )
    .refine(
      (data) => {
        return !(data.mode === 'create' && !data.personBInfo);
      },
      {
        path: ['personBInfo'],
        message: t('patientInformationRequired', 'Por favor proporcione la información del paciente'),
      },
    );
};

// Static schema for cases where translation hook is not available
export const ContactListFormSchema = relationshipFormSchema
  .extend({
    physicalAssault: z.enum([BOOLEAN_YES, BOOLEAN_NO]).optional(),
    threatened: z.enum([BOOLEAN_YES, BOOLEAN_NO]).optional(),
    sexualAssault: z.enum([BOOLEAN_YES, BOOLEAN_NO]).optional(),
    livingWithClient: z.string().optional(),
    baselineStatus: z.string().optional(),
    preferedPNSAproach: z.string().optional(),
    ipvOutcome: z.enum([IPV_OUTCOME_POSITIVE, IPV_OUTCOME_NEGATIVE]).optional(),
    dataConsent: z.boolean().refine((v) => v === true, {
      message: 'Se requiere el consentimiento del titular para registrar sus datos de salud (Ley 29733)',
    }),
  })
  .refine(
    (data) => {
      return !(data.mode === 'search' && !data.personB);
    },
    { message: 'Requerido', path: ['personB'] },
  )
  .refine(
    (data) => {
      return !(data.mode === 'create' && !data.personBInfo);
    },
    { path: ['personBInfo'], message: 'Por favor proporcione la información del paciente' },
  );

// Hook to get localized IPV outcome options
export const useContactIpvOutcomeOptions = () => {
  const { t } = useTranslation();

  return [
    {
      label: t('ipvOutcomePositive', 'Positivo - Se detectó violencia'),
      value: IPV_OUTCOME_POSITIVE,
    },
    {
      label: t('ipvOutcomeNegative', 'Negativo - No se detectó violencia'),
      value: IPV_OUTCOME_NEGATIVE,
    },
  ];
};

// Static options for backwards compatibility
export const contactipvOutcomeOptions = [
  { label: 'Positivo - Se detectó violencia', value: IPV_OUTCOME_POSITIVE },
  { label: 'Negativo - No se detectó violencia', value: IPV_OUTCOME_NEGATIVE },
];

// Hook to get localized HIV status options
export const useHivStatusOptions = () => {
  const { t } = useTranslation();

  return {
    positive: t('hivStatusPositive', 'Positivo'),
    negative: t('hivStatusNegative', 'Negativo'),
    unknown: t('hivStatusUnknown', 'Desconocido'),
  };
};

// Hook to get localized PNS approach options
export const usePnsApproachOptions = () => {
  const { t } = useTranslation();

  return [
    {
      label: t('pnsPatientNotification', 'Notificación por el paciente'),
      value: 'patient_notification',
      description: t('pnsPatientNotificationDesc', 'El paciente notifica directamente a sus parejas'),
    },
    {
      label: t('pnsProviderNotification', 'Notificación por el proveedor'),
      value: 'provider_notification',
      description: t('pnsProviderNotificationDesc', '***El personal de salud contacta a las parejas'),
    },
    {
      label: t('pnsDualNotification', 'Notificación dual'),
      value: 'dual_notification',
      description: t('pnsDualNotificationDesc', 'Combinación de ambos métodos'),
    },
    {
      label: t('pnsAnonymousNotification', 'Notificación anónima'),
      value: 'anonymous_notification',
      description: t('pnsAnonymousNotificationDesc', 'Se notifica sin revelar la identidad del paciente'),
    },
  ];
};

export const getHivStatusBasedOnEnrollmentAndHTSEncounters = (
  encounters: HTSEncounter[],
  enrollment: Enrollment | null,
) => {
  if (enrollment) {
    return 'Positive';
  }
  if (!encounters.length) {
    return 'Unknown';
  }
  if (
    encounters.length &&
    encounters.findIndex((en) =>
      en.obs.some(
        (ob) =>
          ob?.value &&
          ob.value?.display &&
          ['positive', 'hiv positive', 'positivo', 'vih positivo'].includes(ob.value?.display?.toLowerCase()),
      ),
    ) !== -1
  ) {
    return 'Positive';
  }
  return 'Negative';
};

// Hook to get localized HIV status based on clinical data
export const useLocalizedHivStatus = (encounters: HTSEncounter[], enrollment: Enrollment | null) => {
  const { t } = useTranslation();
  const status = getHivStatusBasedOnEnrollmentAndHTSEncounters(encounters, enrollment);

  const statusMap = {
    Positive: t('hivStatusPositive', 'Positivo'),
    Negative: t('hivStatusNegative', 'Negativo'),
    Unknown: t('hivStatusUnknown', 'Desconocido'),
  };

  return {
    status,
    localizedStatus: statusMap[status as keyof typeof statusMap] || status,
    isPositive: status === 'Positive',
    isNegative: status === 'Negative',
    isUnknown: status === 'Unknown',
  };
};

export const saveContact = async (
  data: z.infer<typeof ContactListFormSchema>,
  config: ConfigObject,
  session: Session,
) => {
  const { baselineStatus, ipvOutcome, preferedPNSAproach, livingWithClient, dataConsent } = data;

  // Save contact with relationship
  await saveRelationship(
    omit(data, [
      'baselineStatus',
      'ipvOutcome',
      'physicalAssault',
      'preferedPNSAproach',
      'livingWithClient',
      'sexualAssault',
      'threatened',
      'dataConsent',
    ]),
    config,
    session,
    [
      // Add optional baseline HIV Status attribute
      ...(baselineStatus
        ? [
            {
              attributeType: config.contactPersonAttributesUuid.baselineHIVStatus,
              value: baselineStatus,
            },
          ]
        : []),

      // Add contact created marker for new contacts
      ...(data.mode === 'create'
        ? [
            {
              attributeType: config.contactPersonAttributesUuid.contactCreated,
              value: BOOLEAN_YES,
            },
          ]
        : []),

      // Add preferred PNS approach attribute
      ...(preferedPNSAproach
        ? [
            {
              attributeType: config.contactPersonAttributesUuid.preferedPnsAproach,
              value: preferedPNSAproach,
            },
          ]
        : []),

      // Add living with client attribute
      ...(livingWithClient
        ? [
            {
              attributeType: config.contactPersonAttributesUuid.livingWithContact,
              value: livingWithClient,
            },
          ]
        : []),

      // Add IPV outcome attribute
      ...(ipvOutcome
        ? [
            {
              attributeType: config.contactPersonAttributesUuid.contactipvOutcome,
              value: ipvOutcome,
            },
          ]
        : []),

      // Store data protection consent (Ley 29733)
      ...(config.contactPersonAttributesUuid.dataConsent
        ? [
            {
              attributeType: config.contactPersonAttributesUuid.dataConsent,
              value: dataConsent ? BOOLEAN_YES : BOOLEAN_NO,
            },
          ]
        : []),
    ],
  );
};
