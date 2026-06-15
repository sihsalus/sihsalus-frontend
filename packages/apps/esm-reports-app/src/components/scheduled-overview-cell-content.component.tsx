import { type DataTableCell } from '@carbon/react';
import { Edit, TrashCan } from '@carbon/react/icons';
import { showModal, userHasAccess, useSession } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { PRIVILEGE_SYSTEM_DEVELOPER } from '../constants';
import { closeOverlay, launchOverlay } from '../hooks/useOverlay';

import EditScheduledReportForm from './edit-scheduled-report/edit-scheduled-report-form.component';
import NextReportExecution from './next-report-execution.component';
import ReportOverviewButton from './report-overview-button.component';
import ReportScheduleDescription from './report-schedule-description.component';
import styles from './reports.scss';
import ScheduledReportStatus from './scheduled-report-status.component';

interface ScheduledReportActions {
  reportDefinitionUuid: string;
  reportRequestUuid: string;
}

type ScheduledReportCell = DataTableCell<string | boolean | ScheduledReportActions>;

interface ScheduledOverviewCellContentProps {
  cell: ScheduledReportCell;
  mutate: () => void;
}

const ScheduledOverviewCellContent: React.FC<ScheduledOverviewCellContentProps> = ({ cell, mutate }) => {
  const { t } = useTranslation();
  const session = useSession();

  const stringValue = typeof cell.value === 'string' ? cell.value : '';
  const booleanValue = typeof cell.value === 'boolean' ? cell.value : false;

  const renderContent = () => {
    switch (cell.info.header) {
      case 'name': {
        const v = cell.value as { content?: unknown } | null | undefined;
        return <div>{(v?.content ?? cell.value) as React.ReactNode}</div>;
      }
      case 'status':
        return <ScheduledReportStatus hasSchedule={booleanValue} />;
      case 'schedule':
        return <ReportScheduleDescription schedule={stringValue} />;
      case 'nextRun':
        return <NextReportExecution schedule={stringValue} currentDate={new Date()} />;
      case 'actions': {
        const actions = cell.value as { reportDefinitionUuid: string; reportRequestUuid: string };
        return (
          <div>
            <ReportOverviewButton
              shouldBeDisplayed={userHasAccess(PRIVILEGE_SYSTEM_DEVELOPER, session.user)}
              label={t('edit', 'Edit')}
              icon={() => <Edit size={16} className={styles.actionButtonIcon} />}
              reportRequestUuid={null}
              onClick={() => {
                launchOverlay(
                  t('editScheduledReport', 'Edit scheduled report'),
                  <EditScheduledReportForm
                    reportDefinitionUuid={actions.reportDefinitionUuid}
                    reportRequestUuid={actions.reportRequestUuid}
                    closePanel={() => {
                      closeOverlay();
                      mutate();
                    }}
                  />,
                );
              }}
            />
            <ReportOverviewButton
              shouldBeDisplayed={!!actions.reportRequestUuid && userHasAccess(PRIVILEGE_SYSTEM_DEVELOPER, session.user)}
              label={t('deleteSchedule', 'Delete Schedule')}
              icon={() => <TrashCan size={16} className={styles.actionButtonIcon} />}
              reportRequestUuid={actions.reportRequestUuid}
              onClick={() => launchDeleteReportScheduleDialog(actions.reportRequestUuid)}
            />
          </div>
        );
      }
      default: {
        const v = cell.value as { content?: unknown } | null | undefined;
        return <span>{(v?.content ?? cell.value) as React.ReactNode}</span>;
      }
    }
  };

  const launchDeleteReportScheduleDialog = (reportRequestUuid: string) => {
    const dispose = showModal('cancel-report-modal', {
      closeModal: () => {
        dispose();
        mutate();
      },
      reportRequestUuid,
      modalType: 'schedule',
    });
  };

  return renderContent();
};

export default ScheduledOverviewCellContent;
