import { Button, ClickableTile, Tag } from '@carbon/react';
import { ArrowRight, CheckmarkOutline, Pending, Search } from '@carbon/react/icons';
import { PageHeader, PageHeaderContent, PatientSearchPictogram } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import styles from './home.scss';

const screeningDomains = [
  {
    key: 'vih',
    titleKey: 'hivScreeningTitle',
    titleDefault: 'Tamizaje VIH',
    descriptionKey: 'hivScreeningDescription',
    descriptionDefault:
      'Revisión de tamizaje, prueba inicial y resultados HTS registrados en la historia del paciente.',
    statusKey: 'available',
    statusDefault: 'Disponible',
    enabled: true,
  },
  {
    key: 'tb',
    titleKey: 'tbScreeningTitle',
    titleDefault: 'Tamizaje TB',
    descriptionKey: 'tbScreeningDescription',
    descriptionDefault: 'Evaluación inicial de signos, síntomas y criterios de descarte o derivación por tuberculosis.',
    statusKey: 'planned',
    statusDefault: 'Planificado',
    enabled: false,
  },
  {
    key: 'cardiometabolic',
    titleKey: 'cardiometabolicScreeningTitle',
    titleDefault: 'Diabetes / riesgo cardiovascular',
    descriptionKey: 'cardiometabolicScreeningDescription',
    descriptionDefault: 'Tamizaje de diabetes, hipertensión y riesgo cardiovascular para identificación temprana.',
    statusKey: 'planned',
    statusDefault: 'Planificado',
    enabled: false,
  },
  {
    key: 'mental-health',
    titleKey: 'mentalHealthScreeningTitle',
    titleDefault: 'Salud mental',
    descriptionKey: 'mentalHealthScreeningDescription',
    descriptionDefault: 'Tamizajes breves de salud mental y factores psicosociales para derivación o seguimiento.',
    statusKey: 'planned',
    statusDefault: 'Planificado',
    enabled: false,
  },
];

const Home: React.FC = () => {
  const { t } = useTranslation();

  return (
    <main className="omrs-main-content">
      <PageHeader className={styles.header}>
        <PageHeaderContent title={t('tamizajes', 'Tamizajes')} illustration={<PatientSearchPictogram />} />
      </PageHeader>
      <section className={styles.container}>
        <div className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>{t('firstLevelCare', 'Primer nivel de atención')}</p>
            <h2>{t('screeningWorklistTitle', 'Tamizajes transversales')}</h2>
            <p className={styles.description}>
              {t(
                'screeningWorklistDescription',
                'Acceso operativo para registrar, revisar y organizar tamizajes que pueden derivar a seguimiento de casos o atención especializada.',
              )}
            </p>
          </div>
          <Button kind="primary" renderIcon={Search} disabled>
            {t('searchPatientToScreen', 'Buscar paciente para tamizaje')}
          </Button>
        </div>
        <div className={styles.grid}>
          {screeningDomains.map((domain) => (
            <ClickableTile key={domain.key} className={styles.tile} disabled={!domain.enabled}>
              <div className={styles.tileHeader}>
                <h3>{t(domain.titleKey, domain.titleDefault)}</h3>
                <Tag type={domain.enabled ? 'green' : 'gray'}>
                  {domain.enabled ? <CheckmarkOutline size={14} /> : <Pending size={14} />}
                  {t(domain.statusKey, domain.statusDefault)}
                </Tag>
              </div>
              <p>{t(domain.descriptionKey, domain.descriptionDefault)}</p>
              <span className={styles.tileAction}>
                {domain.enabled
                  ? t('reviewInPatientChart', 'Revisar desde la historia del paciente')
                  : t('comingSoon', 'Próximamente')}
                <ArrowRight size={16} />
              </span>
            </ClickableTile>
          ))}
        </div>
      </section>
    </main>
  );
};

export default Home;
