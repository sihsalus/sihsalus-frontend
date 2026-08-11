import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { Component, type FC, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import CurrentVisit from '../current-visit/current-visit-summary.component';
import PastVisit from '../past-visit/past-visit.component';
import { type QueueEntry } from '../types';

interface DetailErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  resetKey: string;
}

interface DetailErrorBoundaryState {
  hasError: boolean;
}

class DetailErrorBoundary extends Component<DetailErrorBoundaryProps, DetailErrorBoundaryState> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(previousProps: DetailErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

const QueueTableExpandedRow: FC<{ queueEntry: QueueEntry }> = ({ queueEntry }) => {
  const { t } = useTranslation();
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const patientUuid = queueEntry.patient?.uuid;
  const detailFallback = (
    <p role="alert">
      {t(
        'unableToDisplayVisitDetails',
        'No se pudo mostrar el detalle de esta consulta. Seleccione otra pestaña o cierre y vuelva a abrir la fila.',
      )}
    </p>
  );

  if (!patientUuid) {
    return <p role="alert">{t('queueEntryWithoutPatient', 'Esta entrada no tiene un paciente asociado.')}</p>;
  }

  return (
    <Tabs selectedIndex={selectedTabIndex} onChange={({ selectedIndex }) => setSelectedTabIndex(selectedIndex)}>
      <TabList aria-label={t('visitTabs', 'Visit tabs')}>
        <Tab>{t('currentVisit', 'Current visit')}</Tab>
        <Tab>{t('previousVisit', 'Previous visit')} </Tab>
      </TabList>
      <TabPanels>
        <TabPanel>
          {selectedTabIndex === 0 ? (
            <DetailErrorBoundary fallback={detailFallback} resetKey={`${queueEntry.uuid}-current`}>
              {queueEntry.visit?.uuid ? (
                <CurrentVisit patientUuid={patientUuid} visitUuid={queueEntry.visit.uuid} />
              ) : (
                <p>{t('noVisitAssociatedWithQueueEntry', 'No visit is associated with this queue entry.')}</p>
              )}
            </DetailErrorBoundary>
          ) : null}
        </TabPanel>
        <TabPanel>
          {selectedTabIndex === 1 ? (
            <DetailErrorBoundary fallback={detailFallback} resetKey={`${queueEntry.uuid}-previous`}>
              <PastVisit patientUuid={patientUuid} />
            </DetailErrorBoundary>
          ) : null}
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
};

export default QueueTableExpandedRow;
