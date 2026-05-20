import {
  Button,
  InlineLoading,
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
  Tag,
} from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { formatDate, useConfig } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { useEthnicIdentity } from '../hooks/useEthnicIdentity';
import { patientFormEntryWorkspace } from '../utils/constants';
import styles from './consulta-externa-dashboard.scss';

interface PertenenciaEtnicaProps {
  patientUuid: string;
}

const ethnicTagType: Record<string, 'green' | 'blue' | 'purple' | 'magenta' | 'teal' | 'cyan' | 'warm-gray'> = {
  Quechua: 'purple',
  Aimara: 'blue',
  'Nativo o Indígena de la Amazonía': 'green',
  'Negro / Mulato / Zambo / Afro-peruano': 'magenta',
  Blanco: 'cyan',
  Mestizo: 'teal',
  Otro: 'warm-gray',
};

const PertenenciaEtnica: React.FC<PertenenciaEtnicaProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const { currentValue, entries, isLoading } = useEthnicIdentity(patientUuid, config.concepts?.ethnicIdentityUuid);

  const handleLaunchForm = () => {
    launchPatientWorkspace(patientFormEntryWorkspace, {
      formInfo: {
        patientUuid,
        formUuid: config.formsList?.consultaExternaForm,
      },
    });
  };

  if (isLoading) {
    return <InlineLoading description={t('loading', 'Cargando...')} />;
  }

  return (
    <div className={styles.widgetContainer}>
      <div className={styles.tableHeader}>
        <span className={styles.tableHeaderTitle}>{t('ethnicIdentity', 'Pertenencia Étnica')}</span>
        <Button kind="ghost" size="sm" renderIcon={Add} onClick={handleLaunchForm}>
          {t('recordEthnicIdentity', 'Registrar')}
        </Button>
      </div>

      {currentValue ? (
        <StructuredListWrapper isCondensed>
          <StructuredListHead>
            <StructuredListRow head>
              <StructuredListCell head>{t('currentIdentity', 'Identificación Actual')}</StructuredListCell>
              <StructuredListCell head>{t('dateRecorded', 'Fecha de Registro')}</StructuredListCell>
            </StructuredListRow>
          </StructuredListHead>
          <StructuredListBody>
            {entries.map((entry) => (
              <StructuredListRow key={entry.obsUuid}>
                <StructuredListCell>
                  <Tag type={ethnicTagType[entry.value] ?? 'warm-gray'} size="sm">
                    {entry.value}
                  </Tag>
                </StructuredListCell>
                <StructuredListCell>{formatDate(new Date(entry.encounterDatetime))}</StructuredListCell>
              </StructuredListRow>
            ))}
          </StructuredListBody>
        </StructuredListWrapper>
      ) : (
        <div className={styles.emptyState}>
          <p>{t('noEthnicIdentityData', 'No se ha registrado la pertenencia étnica de este paciente.')}</p>
        </div>
      )}
    </div>
  );
};

export default PertenenciaEtnica;
