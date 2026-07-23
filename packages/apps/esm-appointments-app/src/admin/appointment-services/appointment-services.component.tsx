import { Button, ButtonSet, Dropdown, Layer, SelectItem, TextInput, TimePicker, TimePickerSelect } from '@carbon/react';
import { showSnackbar, useLocations } from '@openmrs/esm-framework';
import { Form, Formik, type FormikHelpers } from 'formik';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { appointmentLocationTagName } from '../../constants';
import { closeOverlay } from '../../hooks/useOverlay';
import type { AppointmentService } from '../../types';
import styles from './appointment-services.scss';
import { useAppointmentServices } from './appointment-services-hook';
import { validationSchema } from './appointment-services-validation';

const isSuccessfulCreateResponse = (status?: number) => status >= 200 && status < 300 && status !== 204;

const AppointmentServices: React.FC = () => {
  const { t } = useTranslation();
  const { appointmentServiceInitialValue, addNewAppointmentService } = useAppointmentServices();

  const locations = useLocations(appointmentLocationTagName);
  const handleSubmit = async (values: AppointmentService, _helpers: FormikHelpers<AppointmentService>) => {
    const payload = {
      name: values.name,
      startTime: values.startTime.concat(':00'),
      endTime: values.endTime.concat(':00'),
      durationMins: values.durationMins,
      color: values.color,
      locationUuid: values.location.uuid,
    };
    addNewAppointmentService(payload).then(
      ({ status }) => {
        if (isSuccessfulCreateResponse(status)) {
          showSnackbar({
            isLowContrast: true,
            kind: 'success',
            subtitle: t('appointmentServiceCreate', 'Appointment service created successfully'),
            title: t('appointmentService', 'Appointment service'),
          });
          closeOverlay();
        }
      },
      (error) => {
        showSnackbar({
          title: t('errorCreatingAppointmentService', 'Error creating appointment service'),
          kind: 'error',
          subtitle: error?.message,
        });
      },
    );
  };
  return (
    <Formik
      onSubmit={handleSubmit}
      isInitialValid={false}
      validationSchema={validationSchema}
      initialValues={appointmentServiceInitialValue}
    >
      {(props) => {
        return (
          <Form onSubmit={props.handleSubmit} className={styles.appointmentServiceContainer}>
            <p className={styles.formTitle}>{t('createAppointmentService', 'Create appointment service')}</p>
            <Layer>
              <TextInput
                id="name"
                invalidText={t(props.errors.name)}
                labelText={t('appointmentServiceName', 'Appointment service name')}
                placeholder={t('appointmentServiceName', 'Appointment service name')}
                invalid={!!(props.touched && props.errors.name)}
                onChange={props.handleChange}
                value={props.values.name}
                name="name"
                onBlur={props.handleBlur}
              />
            </Layer>
            <Layer>
              <TimePicker
                className={styles.timePickerInput}
                invalid={!!(props.touched && props.errors.startTime)}
                pattern="([\d]+:[\d]{2})"
                value={props.values.startTime}
                onChange={props.handleChange}
                labelText={t('startTime', 'Start Time')}
                id="start-time-picker"
              >
                <TimePickerSelect
                  name="startTimeTimeFormat"
                  onChange={props.handleChange}
                  value={props.values.startTimeTimeFormat}
                  id="start-time-picker"
                  aria-label={t('time', 'Time')}
                >
                  <SelectItem value="AM" text="AM" />
                  <SelectItem value="PM" text="PM" />
                </TimePickerSelect>
              </TimePicker>
            </Layer>

            <Layer>
              <TimePicker
                invalid={!!(props.touched && props.errors.endTime)}
                className={styles.timePickerInput}
                pattern="([\d]+:[\d]{2})"
                value={props.values.endTime}
                onChange={props.handleChange}
                labelText={t('endTime', 'End Time')}
                id="end-time-picker"
              >
                <TimePickerSelect
                  name="endTimeTimeFormat"
                  onChange={props.handleChange}
                  id="end-time-picker"
                  value={props.values.endTimeTimeFormat}
                  aria-label={t('time', 'Time')}
                >
                  <SelectItem value="AM" text="AM" />
                  <SelectItem value="PM" text="PM" />
                </TimePickerSelect>
              </TimePicker>
            </Layer>

            <Layer>
              <TextInput
                id="durationMins"
                invalidText={props.errors.durationMins}
                labelText={t('durationMins', 'Duration min')}
                placeholder={t('durationMins', 'Duration min')}
                invalid={!!(props.touched && props.errors.durationMins)}
                onChange={props.handleChange}
                value={props.values.durationMins}
                name="durationMins"
              />
            </Layer>

            <Layer>
              <Dropdown
                id="default"
                titleText={t('selectLocation', 'Select UPSS')}
                label={t('selectLocation', 'Select UPSS')}
                items={locations}
                itemToString={(item) => (item ? item.display : '')}
                selectedItem={props.values.location}
                invalid={!!(props.touched && props.errors.location?.uuid)}
                onChange={({ selectedItem }) => props.setValues({ ...props.values, location: selectedItem })}
              />
            </Layer>

            <Layer>
              <TextInput
                id="color"
                invalid={!!(props.touched && props.errors.color)}
                onChange={props.handleChange}
                invalidText={props.errors.color}
                labelText={t('appointmentColor', 'Appointment color')}
                type="color"
                name="color"
              />
            </Layer>

            <ButtonSet className={styles.buttonSet}>
              <Button
                onClick={closeOverlay}
                style={{ maxWidth: 'none', width: '50%' }}
                className={styles.button}
                kind="secondary"
              >
                {t('discard', 'Discard')}
              </Button>
              <Button
                disabled={!props.isValid}
                style={{ maxWidth: 'none', width: '50%' }}
                className={styles.button}
                kind="primary"
                type="submit"
              >
                {t('save', 'Save')}
              </Button>
            </ButtonSet>
          </Form>
        );
      }}
    </Formik>
  );
};

export default AppointmentServices;
