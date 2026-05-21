import { Button, ButtonSet, Form, Select, SelectItem } from '@carbon/react';
import { showSnackbar, useLayoutType } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { take } from 'rxjs/operators';

import { closeOverlay } from '../../hooks/useOverlay';
import ReportParameter from '../report-parameter.component';
import { runReportObservable, useLocations, useReportDefinitions, useReportDesigns } from '../reports.resource';

import styles from './run-report-form.scss';

interface RunReportFormProps {
  closePanel: () => void;
}

const RunReportForm: React.FC<RunReportFormProps> = ({ closePanel }) => {
  const { t } = useTranslation();
  const [reportUuid, setReportUuid] = useState('');
  const [renderModeUuid, setRenderModeUuid] = useState('');
  const [currentReport, setCurrentReport] = useState(null);
  const [reportParameters, setReportParameters] = useState({});
  const [isFormValid, setIsFormValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isTablet = useLayoutType() === 'tablet';

  const { reportDesigns, mutateReportDesigns } = useReportDesigns(reportUuid);

  const supportedParameterTypes = useMemo(
    () => [
      'java.util.Date',
      'java.lang.String',
      'java.lang.Integer',
      'org.openmrs.Location',
      'org.openmrs.Concept',
      'org.openmrs.EncounterType',
    ],
    [],
  );

  useEffect(() => {
    mutateReportDesigns();
  }, [mutateReportDesigns]);

  useEffect(() => {
    const paramTypes = currentReport?.parameters.map((param) => param.type);

    const isAnyNotSupportedType =
      paramTypes?.some((paramType) => !supportedParameterTypes.includes(paramType)) ?? false;
    const allRequiredParametersValid =
      currentReport?.parameters?.every((parameter) => {
        if (!parameter.required) {
          return true;
        }

        const paramValue = reportParameters[parameter.name];
        const isValid = !!paramValue && paramValue !== 'Invalid Date' && paramValue !== '';
        return isValid;
      }) ?? true;

    if (!isAnyNotSupportedType && allRequiredParametersValid && reportUuid !== '' && renderModeUuid !== '') {
      setIsFormValid(true);
    } else {
      setIsFormValid(false);
    }
  }, [reportParameters, reportUuid, renderModeUuid, currentReport?.parameters, supportedParameterTypes]);

  const { reportDefinitions } = useReportDefinitions();
  const { locations } = useLocations();

  function handleOnChange(event) {
    const key = event.target.name;
    let value = null;
    if (event.target.type === 'checkbox') {
      value = event.target.checked;
    } else {
      value = event.target.value;
    }

    setReportParameters((state) => ({ ...state, [key]: value }));
  }

  function handleOnDateChange(fieldName, dateValue) {
    setReportParameters((state) => ({ ...state, [fieldName]: dateValue }));
  }

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();

      setIsSubmitting(true);

      const reportRequest = {
        uuid: null,
        reportDefinition: {
          parameterizable: {
            uuid: reportUuid,
          },
          parameterMappings: reportParameters,
        },
        renderingMode: {
          argument: renderModeUuid,
        },
        schedule: null,
      };

      runReportObservable(reportRequest)
        .pipe(take(1))
        .subscribe(
          () => {
            // delayed handling because runReport returns before new reports is accessible via GET
            setTimeout(() => {
              showSnackbar({
                kind: 'success',
                title: t('reportRanSuccessfully', 'Report ran successfully'),
              });
              closePanel();
              setIsSubmitting(false);
            }, 500);
          },
          (error) => {
            console.error(error);
            showSnackbar({
              kind: 'error',
              title: t('errorRunningReport', 'Error running report'),
              subtitle: error?.message,
            });
            setIsSubmitting(false);
          },
        );
    },
    [closePanel, reportParameters, reportUuid, renderModeUuid, t],
  );

  return (
    <Form className={styles.desktopRunReport} onSubmit={handleSubmit}>
      <div className={styles.runReportInnerDivElement}>
        <Select
          id="select-report"
          className={styles.basicInputElement}
          labelText={t('selectReportLabel', 'Report')}
          onChange={(e) => {
            setReportUuid(e.target.value);
            setRenderModeUuid('');
            setCurrentReport(reportDefinitions.find((reportDefinition) => reportDefinition.uuid === e.target.value));
            setReportParameters({});
          }}
          value={reportUuid}
        >
          <SelectItem text="" value={''} />
          {reportDefinitions?.map((reportDefinition) => (
            <SelectItem key={reportDefinition.uuid} text={reportDefinition.name} value={reportDefinition.uuid}>
              {reportDefinition.name}
            </SelectItem>
          ))}
        </Select>
      </div>
      <div id="reportParametersDiv" className={styles.runReportInnerDivElement}>
        {currentReport?.parameters?.map((parameter) => {
          return parameter.type === 'java.util.Date' ? (
            <ReportParameter
              key={parameter.name + reportUuid}
              parameter={parameter}
              reportUuid={reportUuid}
              reportParameters={reportParameters}
              locations={locations}
              handleOnDateChange={handleOnDateChange}
              handleOnChange={undefined}
            />
          ) : (
            <ReportParameter
              key={parameter.name + reportUuid}
              parameter={parameter}
              reportUuid={reportUuid}
              reportParameters={reportParameters}
              locations={locations}
              handleOnChange={handleOnChange}
              handleOnDateChange={undefined}
            />
          );
        })}
      </div>
      <div className={styles.outputFormatDiv}>
        <Select
          id="output-format-select"
          className={styles.basicInputElement}
          labelText={t('outputFormat', 'Output format')}
          onChange={(e) => setRenderModeUuid(e.target.value)}
          value={renderModeUuid}
        >
          <SelectItem text="" value={''} />
          {reportDesigns?.map((reportDesign) => (
            <SelectItem key={reportDesign.uuid} text={reportDesign.name} value={reportDesign.uuid}>
              {reportDesign.name}
            </SelectItem>
          ))}
        </Select>
      </div>
      <div className={styles.buttonsDiv}>
        <ButtonSet className={classNames({ [styles.tablet]: isTablet, [styles.desktop]: !isTablet })}>
          <Button onClick={closeOverlay} kind="secondary" size="xl" className={styles.reportButton}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button
            disabled={!isFormValid || isSubmitting}
            size="xl"
            className={styles.reportButton}
            kind="primary"
            type="submit"
          >
            {t('run', 'Run')}
          </Button>
        </ButtonSet>
      </div>
    </Form>
  );
};

export default RunReportForm;
