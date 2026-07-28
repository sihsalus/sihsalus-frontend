import { Button } from '@carbon/react';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import FormWorkflowContext from '../../context/form-workflow-context';
import FormReviewCard from '../form-review-card';
import styles from './styles.scss';

const WorkflowReview = () => {
  const { patientUuids } = useContext(FormWorkflowContext);
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className={styles.workspaceWrapper}>
      <div className={styles.workspace}>
        <div className={styles.leftPanel}>
          <h4>{t('review', 'Review')}</h4>
          <div className={styles.navButtons}>
            <Button kind="primary" onClick={() => navigate('/')}>
              {t('save&close', 'Save & Close')}
            </Button>
            <Button kind="tertiary" onClick={() => navigate('/')}>
              {t('cancel', 'Cancel')}
            </Button>
          </div>
        </div>
        <div className={styles.formContainer}>
          {patientUuids.map((patientUuid) => (
            <FormReviewCard patientUuid={patientUuid} key={patientUuid} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkflowReview;
