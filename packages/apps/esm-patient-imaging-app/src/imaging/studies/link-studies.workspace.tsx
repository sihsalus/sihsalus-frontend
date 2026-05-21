import {
  Button,
  ButtonSet,
  ComboBox,
  Form,
  FormGroup,
  InlineLoading,
  RadioButton,
  RadioButtonGroup,
  Row,
  Stack,
} from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createErrorHandler,
  ExtensionSlot,
  launchWorkspace,
  ResponsiveWrapper,
  showSnackbar,
  useLayoutType,
} from '@openmrs/esm-framework';
import { type DefaultPatientWorkspaceProps } from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { getLinkStudies, useOrthancConfigurations } from '../../api';
import { type OrthancConfiguration } from '../../types';
import { assignStudiesFormWorkspace } from '../constants';
import styles from './studies.scss';

const LinkStudiesWorkspace: React.FC<DefaultPatientWorkspaceProps> = ({ patientUuid, closeWorkspace }) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const orthancConfigurations = useOrthancConfigurations();
  const [isLoading, setIsLoading] = useState(false);
  const patientState = useMemo(() => ({ patientUuid }), [patientUuid]);

  const linkStudiesFormSchema = useMemo(() => {
    return z.object({
      fetchOption: z.string(),
      orthancConfiguration: z.object({
        id: z.number(),
        orthancBaseUrl: z.string(),
        orthancProxyUrl: z.string().nullable().optional(),
      }),
    });
  }, []);

  type LinkStudiesFormData = z.infer<typeof linkStudiesFormSchema>;

  const formProps = useForm<LinkStudiesFormData>({
    mode: 'all',
    resolver: zodResolver(linkStudiesFormSchema),
  });

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = formProps;

  const fetchOptions = useMemo(
    () => [
      { id: 'all', display: 'All' },
      { id: 'newest', display: 'Newest' },
    ],
    [],
  );

  useEffect(() => {
    setValue('fetchOption', fetchOptions[0].id);
  }, [setValue, fetchOptions]);

  const onSubmit = useCallback(
    async (data: LinkStudiesFormData) => {
      const { fetchOption, orthancConfiguration } = data;

      const abortController = new AbortController();

      // copy the content because zod library makes everything optional
      const serverConfig: OrthancConfiguration = {
        id: orthancConfiguration.id,
        orthancBaseUrl: orthancConfiguration.orthancBaseUrl,
        orthancProxyUrl: orthancConfiguration.orthancProxyUrl,
      };

      try {
        await getLinkStudies(fetchOption, serverConfig, abortController);
        closeWorkspace();
        launchWorkspace(assignStudiesFormWorkspace, { configuration: serverConfig, patientUuid });
      } catch (err) {
        createErrorHandler();
        showSnackbar({
          title: t('linkStudiesError', 'An error occurred while linking the studies to the patient'),
          kind: 'error',
          isLowContrast: false,
          subtitle: t('checkForConnection', 'Check the connection with the configured server') + ': ' + err?.message,
        });
      } finally {
        abortController.abort();
        setIsLoading(false);
      }
    },
    [closeWorkspace, t, patientUuid],
  );

  return (
    <FormProvider {...formProps}>
      {isLoading && <InlineLoading description={t('linkingStudies', 'Linking studies...')} />}
      <Form className={styles.formContainer} onSubmit={handleSubmit(onSubmit)} id="linkStudies">
        {isTablet ? (
          <Row className={styles.header}>
            <ExtensionSlot className={styles.content} name="patient-details-header-slot" state={patientState} />
          </Row>
        ) : null}
        <Stack gap={1} className={styles.formContent}>
          <section>
            <ResponsiveWrapper>
              <FormGroup legendText={t('linkFetchOption', 'Fetch option for link studies')}>
                <Controller
                  name="fetchOption"
                  control={control}
                  render={({ field: { value, onChange } }) => (
                    <RadioButtonGroup name="linkFetchOption" valueSelected={value} onChange={onChange}>
                      {fetchOptions.map(({ id, display }) => (
                        <RadioButton key={id} id={id} labelText={display} value={id} />
                      ))}
                    </RadioButtonGroup>
                  )}
                />
              </FormGroup>
            </ResponsiveWrapper>
          </section>
          <section>
            <ResponsiveWrapper>
              <FormGroup legendText={t('orthancConfiguration', 'Orthanc configurations')}>
                <Controller
                  name="orthancConfiguration"
                  control={control}
                  render={({ field: { value, onChange } }) => (
                    <ComboBox
                      id="orthancConfiguration"
                      itemToString={(item: OrthancConfiguration) => item?.orthancBaseUrl}
                      items={orthancConfigurations.data || []}
                      onChange={({ selectedItem }) => onChange(selectedItem)}
                      placeholder={t('selectOrthancServer', 'Select an Orthanc server')}
                      selectedItem={value}
                      invalid={!!errors.orthancConfiguration}
                      invalidText={
                        errors.orthancConfiguration?.message ||
                        t('selectValidServer', 'Please select a valid Orthanc server')
                      }
                    />
                  )}
                />
              </FormGroup>
            </ResponsiveWrapper>
          </section>
          <ButtonSet className={classNames(isTablet ? styles.tabletButtons : styles.desktopButtons)}>
            <Button kind="primary" type="submit">
              {t('fetchStudy', 'Fetch Study')}
            </Button>
            <Button kind="secondary" onClick={() => closeWorkspace()}>
              {t('cancel', 'Cancel')}
            </Button>
          </ButtonSet>
        </Stack>
      </Form>
    </FormProvider>
  );
};

export default LinkStudiesWorkspace;
