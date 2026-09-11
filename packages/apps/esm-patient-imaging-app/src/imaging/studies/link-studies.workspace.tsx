import {
  Button,
  ButtonSet,
  ComboBox,
  Form,
  FormGroup,
  InlineLoading,
  InlineNotification,
  RadioButton,
  RadioButtonGroup,
  Row,
  Stack,
} from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ExtensionSlot, launchWorkspace, ResponsiveWrapper, showSnackbar, useLayoutType } from '@openmrs/esm-framework';
import { type DefaultPatientWorkspaceProps } from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { getLinkStudies, useOrthancConfigurations } from '../../api';
import { type OrthancConfiguration } from '../../types';
import { assignStudiesFormWorkspace } from '../constants';
import { useImagingOperation } from '../utils/use-imaging-operation';
import styles from './studies.scss';

const LinkStudiesWorkspace: React.FC<DefaultPatientWorkspaceProps> = ({ patientUuid, closeWorkspace }) => {
  const { t } = useTranslation();
  const { start, isCurrent, finish, isPending, canWrite } = useImagingOperation(patientUuid);
  const isTablet = useLayoutType() === 'tablet';
  const orthancConfigurations = useOrthancConfigurations();
  const patientState = useMemo(() => ({ patientUuid }), [patientUuid]);

  const linkStudiesFormSchema = useMemo(() => {
    return z.object({
      fetchOption: z.enum(['all', 'newest']),
      orthancConfiguration: z.object({
        id: z.number().int().positive(),
        orthancBaseUrl: z.string(),
        orthancProxyUrl: z.string().nullable().optional(),
      }),
    });
  }, []);

  type LinkStudiesFormData = z.infer<typeof linkStudiesFormSchema>;

  const formProps = useForm<LinkStudiesFormData>({
    mode: 'all',
    resolver: zodResolver(linkStudiesFormSchema),
    defaultValues: { fetchOption: 'all' },
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = formProps;

  useEffect(() => {
    reset();
  }, [patientUuid, reset]);

  const fetchOptions = useMemo(
    () => [
      { id: 'all', display: t('all', 'All') },
      { id: 'newest', display: t('newest', 'Newest') },
    ],
    [t],
  );

  const onSubmit = useCallback(
    async (data: LinkStudiesFormData) => {
      const { fetchOption, orthancConfiguration } = data;

      const abortController = start();
      if (!abortController) return;

      // copy the content because zod library makes everything optional
      const serverConfig: OrthancConfiguration = {
        id: orthancConfiguration.id,
        orthancBaseUrl: orthancConfiguration.orthancBaseUrl,
        orthancProxyUrl: orthancConfiguration.orthancProxyUrl,
      };

      try {
        await getLinkStudies(fetchOption, serverConfig, abortController);
        if (!isCurrent(abortController)) return;
        closeWorkspace();
        launchWorkspace<DefaultPatientWorkspaceProps & { configuration: OrthancConfiguration }>(
          assignStudiesFormWorkspace,
          { configuration: serverConfig, patientUuid },
        );
      } catch {
        if (!isCurrent(abortController)) return;
        showSnackbar({
          title: t('linkStudiesError', 'An error occurred while linking the studies to the patient'),
          kind: 'error',
          isLowContrast: false,
          subtitle: t(
            'imagingOperationFailed',
            'The operation could not be completed. Refresh and check the result before trying again.',
          ),
        });
      } finally {
        finish(abortController);
      }
    },
    [closeWorkspace, t, patientUuid, start, isCurrent, finish],
  );

  return (
    <FormProvider {...formProps}>
      {isPending && <InlineLoading description={t('linkingStudies', 'Linking studies...')} />}
      <Form className={styles.formContainer} onSubmit={handleSubmit(onSubmit)} id="linkStudies">
        {isTablet ? (
          <Row className={styles.header}>
            <ExtensionSlot className={styles.content} name="patient-details-header-slot" state={patientState} />
          </Row>
        ) : null}
        <Stack gap={1} className={styles.formContent}>
          {orthancConfigurations.error && (
            <InlineNotification
              kind="error"
              lowContrast
              hideCloseButton
              title={t('imagingConfigurationUnavailable', 'Imaging servers could not be loaded.')}
            />
          )}
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
                      disabled={isPending}
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
            <Button kind="primary" type="submit" disabled={isPending || !canWrite}>
              {t('fetchStudy', 'Fetch Study')}
            </Button>
            <Button kind="secondary" onClick={() => closeWorkspace()} disabled={isPending}>
              {t('cancel', 'Cancel')}
            </Button>
          </ButtonSet>
        </Stack>
      </Form>
    </FormProvider>
  );
};

export default LinkStudiesWorkspace;
