import { Button, ButtonSet, Form } from '@carbon/react';
import { ArrowLeftIcon, launchWorkspace, useLayoutType } from '@openmrs/esm-framework';
import { type ComponentProps, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type DefaultPatientWorkspaceProps } from '../workspaces';

import FormsList from './forms-list.component';
import styles from './forms-selector.scss';
import type { CompletedFormInfo, Form as FormSchema } from './types';

// Generic type for form launch function
export type FormLaunchHandler = (form: FormSchema, encounterUuid: string, onFormSubmitted: () => void) => void;

export interface FormsSelectorWorkspaceAdditionalProps {
  availableForms: Array<CompletedFormInfo>;
  patientAge: string;
  controlNumber: number;
  title?: string;
  subtitle?: string;
  backWorkspace?: string | null;
  onComplete?: () => void;
  onFormLaunch: FormLaunchHandler; // Generic form launcher function
}

export interface FormsSelectorWorkspaceProps
  extends DefaultPatientWorkspaceProps,
    FormsSelectorWorkspaceAdditionalProps {}

export default function FormsSelectorWorkspace({
  availableForms,
  patientAge,
  controlNumber,
  title,
  subtitle,
  backWorkspace = 'wellchild-control-form',
  onComplete,
  onFormLaunch,
  patientUuid: _patientUuid,
  closeWorkspace,
  closeWorkspaceWithSavedChanges,
}: FormsSelectorWorkspaceProps): JSX.Element {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const [completedForms, setCompletedForms] = useState<Set<string>>(new Set());
  const shouldShowControlInfo = Boolean(patientAge) || controlNumber > 0;

  const backToPreviousWorkspace = useCallback(() => {
    closeWorkspace({
      onWorkspaceClose: () => {
        if (backWorkspace) {
          launchWorkspace(backWorkspace);
        }
      },
      closeWorkspaceGroup: false,
    });
  }, [closeWorkspace, backWorkspace]);

  const handleFormOpen = useCallback(
    (form: FormSchema, encounterUuid: string) => {
      onFormLaunch(form, encounterUuid, () => {
        setCompletedForms((prev) => new Set(prev).add(form.uuid));
      });
    },
    [onFormLaunch],
  );

  const handleFinishControl = useCallback(() => {
    if (onComplete) {
      onComplete();
    }

    closeWorkspaceWithSavedChanges({
      onWorkspaceClose: () => {},
    });
  }, [closeWorkspaceWithSavedChanges, onComplete]);

  const isAnyFormCompleted = completedForms.size > 0;

  return (
    <Form className={styles.form}>
      <div className={styles.grid}>
        {/* Back button */}
        {!isTablet && (
          <div>
            <Button
              iconDescription={t('backToPrevious', 'Volver')}
              kind="ghost"
              onClick={backToPreviousWorkspace}
              renderIcon={(props: ComponentProps<typeof ArrowLeftIcon>) => <ArrowLeftIcon size={24} {...props} />}
              size="sm"
            >
              <span>{t('backToPrevious', 'Volver')}</span>
            </Button>
          </div>
        )}

        {/* Header info */}
        <div>
          <div className={styles.sectionTitle}>{title || t('formsSelection', 'Selección de Formularios')}</div>
          {shouldShowControlInfo && (
            <div className={styles.controlInfoRow}>
              {patientAge && (
                <span>
                  {t('patientAge', 'Edad del paciente')}: {patientAge}
                </span>
              )}
              {controlNumber > 0 && (
                <span>
                  {t('controlNumber', 'Control #')}: {controlNumber}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div>
          <p>
            {subtitle ||
              t(
                'formsInstructions',
                'Seleccione los formularios que desea completar. Puede completar múltiples formularios según las necesidades del paciente.',
              )}
          </p>
        </div>

        {/* Forms table */}
        <div>
          <FormsList
            completedForms={availableForms}
            handleFormOpen={handleFormOpen}
            sectionName={t('availableForms', 'Formularios Disponibles')}
          />
        </div>

        {/* Completed forms counter */}
        {isAnyFormCompleted && (
          <div>
            <p>
              {t('formsCompleted', 'Formularios completados')}: {completedForms.size}
            </p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <ButtonSet className={isTablet ? styles.tablet : styles.desktop}>
        <Button kind="secondary" onClick={backToPreviousWorkspace} className={styles.button}>
          {t('cancel', 'Cancelar')}
        </Button>
        <Button kind="primary" onClick={handleFinishControl} disabled={!isAnyFormCompleted} className={styles.button}>
          {t('finishAndSign', 'Guardar y Firmar')}
        </Button>
      </ButtonSet>
    </Form>
  );
}
