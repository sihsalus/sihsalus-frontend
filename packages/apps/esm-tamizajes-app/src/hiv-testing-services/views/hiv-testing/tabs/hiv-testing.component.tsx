import { formatDate, parseDate, useConfig } from '@openmrs/esm-framework';
import type { EncounterListColumn } from '@openmrs/esm-patient-common-lib';
import { EncounterList, getObsFromEncounter } from '@openmrs/esm-patient-common-lib';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../../../../config-schema';

interface HivTestingEncountersListProps {
  patientUuid: string;
}

const HivTestingEncounters: React.FC<HivTestingEncountersListProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const headerTitle = t('htsInitial', 'HTS Initial Test');

  const {
    encounterTypes: { hivTestingServices },
    formsList: { htsInitialTest, htsRetest },
    hivTestingConcepts: {
      entryPointConcept,
      finalResultConcept,
      tbScreeningConcept,
      testApproachConcept,
      testStrategyConcept,
    },
    hivTestingConceptMap,
  } = useConfig<ConfigObject>();

  const htsEncounterTypeUUID = hivTestingServices;
  const htsInitialEncounterFormUUID = htsInitialTest;

  const columns: EncounterListColumn[] = useMemo(
    () => [
      {
        key: 'testDate',
        header: t('testDate', 'Test Date'),
        getValue: (encounter) => {
          return formatDate(parseDate(encounter.encounterDatetime));
        },
      },
      {
        key: 'htsTestType',
        header: t('htsTestType', 'Test type'),
        getValue: (encounter) => {
          return encounter.form?.name ?? t('unknownForm', 'Unidentified form');
        },
      },
      {
        key: 'testApproach',
        header: t('testApproach', 'Approach'),
        getValue: (encounter) => {
          return getObsFromEncounter(encounter, testApproachConcept);
        },
      },
      {
        key: 'testStrategy',
        header: t('testStrategy', 'Strategy'),
        getValue: (encounter) => {
          return getObsFromEncounter(encounter, testStrategyConcept);
        },
      },
      {
        key: 'testEntryPoint',
        header: t('testEntryPoint', 'Entry point'),
        getValue: (encounter) => {
          return getObsFromEncounter(encounter, entryPointConcept);
        },
      },
      {
        key: 'htsResult',
        header: t('htsResult', 'Final result'),
        getValue: (encounter) => {
          return getObsFromEncounter(encounter, finalResultConcept);
        },
      },
      {
        key: 'tbScreening',
        header: t('tbScreening', 'TB screening outcome'),
        getValue: (encounter) => {
          return getObsFromEncounter(encounter, tbScreeningConcept);
        },
      },
    ],
    [entryPointConcept, finalResultConcept, t, tbScreeningConcept, testApproachConcept, testStrategyConcept],
  );

  return (
    <EncounterList
      patientUuid={patientUuid}
      encounterType={htsEncounterTypeUUID}
      columns={columns}
      description={headerTitle}
      headerTitle={headerTitle}
      launchOptions={{
        hideFormLauncher: true,
        moduleName: 'HTS Clinical View',
      }}
      filter={(encounter) => {
        return encounter.form?.uuid === htsInitialEncounterFormUUID || encounter.form?.uuid === htsRetest;
      }}
      formConceptMap={hivTestingConceptMap}
    />
  );
};

export default HivTestingEncounters;
