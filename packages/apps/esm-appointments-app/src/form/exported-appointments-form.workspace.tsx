import { type Workspace2DefinitionProps } from '@openmrs/esm-framework';
import React from 'react';
import type { Appointment, RecurringPattern } from '../types';
import AppointmentsForm from './appointments-form.workspace';

interface ExportedAppointmentsFormProps {
  patientUuid: string;
  appointment?: Appointment;
  recurringPattern?: RecurringPattern;
  context?: string;
  workspaceTitle?: string;
}

/**
 * Workspace used to create or edit an appointment in the patient chart (or app with compatible workspaceGroup).
 * This wrapper exposes the appointments form as a standalone workspace that can be launched from outside
 * the appointments app (e.g. from the patient chart).
 */
const ExportedAppointmentsForm: React.FC<
  Workspace2DefinitionProps<ExportedAppointmentsFormProps, object> & ExportedAppointmentsFormProps
> = (props) => {
  const workspaceProps = (props.workspaceProps ?? {}) as Partial<ExportedAppointmentsFormProps>;
  const patientUuid = props.patientUuid ?? workspaceProps.patientUuid;
  const appointment = props.appointment ?? workspaceProps.appointment;
  const recurringPattern = props.recurringPattern ?? workspaceProps.recurringPattern;
  const context = props.context ?? workspaceProps.context ?? 'creating';
  const workspaceTitle = props.workspaceTitle ?? workspaceProps.workspaceTitle;

  return (
    <AppointmentsForm
      {...props}
      patientUuid={patientUuid}
      appointment={appointment}
      recurringPattern={recurringPattern}
      context={context}
      workspaceTitle={workspaceTitle}
    />
  );
};

export default ExportedAppointmentsForm;
