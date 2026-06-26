import { ModalBody, ModalHeader } from '@carbon/react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { basePath } from '../../constants';
import Trendline from '../trendline/trendline.component';
import usePanelData from '../panel-view/usePanelData';
import HistoricalTable from './historical-table.component';

interface TimelineResultsModalProps {
  closeDeleteModal: () => void;
  patientUuid: string;
  testUuid: string;
  title: string;
}

const TimelineResultsModal: React.FC<TimelineResultsModalProps> = ({ closeDeleteModal, patientUuid, testUuid, title }) => {
  const { t } = useTranslation();
  const { panels, groupedObservations } = usePanelData();

  const { numericUuids, nonNumericUuids } = useMemo(() => {
    // Find if the testUuid is a panel/group
    const panel = panels.find((p) => p.conceptUuid === testUuid);
    const conceptUuids = panel?.relatedObs?.length
      ? panel.relatedObs.map((obs) => obs.conceptUuid)
      : [testUuid];

    const numeric: string[] = [];
    const nonNumeric: string[] = [];

    conceptUuids.forEach((uuid) => {
      const obs = groupedObservations[uuid] || [];
      if (obs.length > 0) {
        const isNum = !Number.isNaN(Number.parseFloat(obs[0].value));
        if (isNum) {
          numeric.push(uuid);
        } else {
          nonNumeric.push(uuid);
        }
      } else {
        nonNumeric.push(uuid);
      }
    });

    return { numericUuids: numeric, nonNumericUuids: nonNumeric };
  }, [testUuid, panels, groupedObservations]);

  return (
    <div>
      <ModalHeader title={title || t('results', 'Results')} closeModal={closeDeleteModal} />
      <ModalBody style={{ paddingBottom: '2rem' }}>
        {numericUuids.length > 0 && (
          <div>
            {nonNumericUuids.length > 0 && (
              <h5 style={{ margin: '1rem 0 0.5rem 0', fontWeight: 'bold' }}>
                {t('numericResults', 'Numeric Results')}
              </h5>
            )}
            <Trendline
              basePath={basePath}
              conceptUuid={numericUuids[0]}
              conceptUuids={numericUuids}
              patientUuid={patientUuid}
              hideTrendlineHeader={true}
            />
          </div>
        )}
        {nonNumericUuids.length > 0 && (
          <div style={{ marginTop: numericUuids.length > 0 ? '2rem' : '0' }}>
            {numericUuids.length > 0 && (
              <h5 style={{ margin: '1rem 0 0.5rem 0', fontWeight: 'bold' }}>
                {t('nonNumericResults', 'Non-Numeric Results')}
              </h5>
            )}
            <HistoricalTable conceptUuids={nonNumericUuids} groupedObservations={groupedObservations} />
          </div>
        )}
      </ModalBody>
    </div>
  );
};

export default TimelineResultsModal;
