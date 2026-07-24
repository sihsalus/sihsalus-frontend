import { Button, ButtonSet, Form, Select, SelectItem, Stack, TextInput } from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  getUserFacingErrorMessage,
  showSnackbar,
  Workspace2,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import { estimatePatientBirthdateFromAge, MAX_PATIENT_AGE_YEARS } from '@openmrs/esm-utils';
import React, { useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { createCompanionPerson, type CompanionRecord } from './companion.resource';
import { type CompanionWorkspaceProps } from './companion-person-search.workspace';
import styles from './companion-workspace.scss';

interface CompanionPersonFormValues {
  givenName: string;
  middleName: string;
  familyName: string;
  familyName2: string;
  gender: 'M' | 'F' | 'O' | 'U' | '';
  estimatedAge: string;
}

const namePattern = /^[\p{L}\p{M}' -]+$/u;

const CompanionPersonRegistrationWorkspace: React.FC<Workspace2DefinitionProps<CompanionWorkspaceProps>> = ({
  workspaceProps,
  closeWorkspace,
}) => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const createdPerson = useRef<{ uuid: string; name: string } | null>(null);
  const schema = useMemo(
    () =>
      z.object({
        givenName: z
          .string()
          .trim()
          .min(2, t('givenNameRequired', 'Ingrese el primer nombre'))
          .max(50, t('nameTooLong', 'El nombre es demasiado largo'))
          .regex(namePattern, t('nameContainsInvalidCharacters', 'El nombre contiene caracteres no válidos')),
        middleName: z
          .string()
          .trim()
          .max(50, t('nameTooLong', 'El nombre es demasiado largo'))
          .refine((value) => !value || namePattern.test(value), {
            message: t('nameContainsInvalidCharacters', 'El nombre contiene caracteres no válidos'),
          }),
        familyName: z
          .string()
          .trim()
          .min(2, t('familyNameRequired', 'Ingrese el apellido paterno'))
          .max(50, t('nameTooLong', 'El nombre es demasiado largo'))
          .regex(namePattern, t('nameContainsInvalidCharacters', 'El nombre contiene caracteres no válidos')),
        familyName2: z
          .string()
          .trim()
          .max(50, t('nameTooLong', 'El nombre es demasiado largo'))
          .refine((value) => !value || namePattern.test(value), {
            message: t('nameContainsInvalidCharacters', 'El nombre contiene caracteres no válidos'),
          }),
        gender: z.enum(['M', 'F', 'O', 'U'], {
          errorMap: () => ({
            message: t('genderRequired', 'Seleccione el sexo'),
          }),
        }),
        estimatedAge: z
          .string()
          .trim()
          .refine((value) => /^\d+$/.test(value), t('estimatedAgeRequired', 'Ingrese la edad aproximada'))
          .refine((value) => Number(value) <= MAX_PATIENT_AGE_YEARS, {
            message: t('estimatedAgeInvalid', 'Ingrese una edad válida'),
          })
          .refine((value) => !workspaceProps.requireAdult || Number(value) >= 18, {
            message: t('adultCompanionRequired', 'El acompañante de un menor debe ser una persona adulta.'),
          }),
      }),
    [t, workspaceProps.requireAdult],
  );
  const {
    formState: { errors, isDirty },
    handleSubmit,
    register,
  } = useForm<CompanionPersonFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      givenName: '',
      middleName: '',
      familyName: '',
      familyName2: '',
      gender: '',
      estimatedAge: '',
    },
  });

  const onSubmit = async (values: CompanionPersonFormValues) => {
    setIsSaving(true);
    try {
      const displayName = [values.givenName, values.middleName, values.familyName, values.familyName2]
        .map((value) => value.trim())
        .filter(Boolean)
        .join(' ');
      if (!createdPerson.current) {
        const person = await createCompanionPerson({
          names: [
            {
              givenName: values.givenName.trim(),
              middleName: values.middleName.trim() || undefined,
              familyName: values.familyName.trim(),
              familyName2: values.familyName2.trim() || undefined,
              preferred: true,
            },
          ],
          gender: values.gender,
          birthdate: estimatePatientBirthdateFromAge(Number(values.estimatedAge)),
          birthdateEstimated: true,
        });
        createdPerson.current = { uuid: person.uuid, name: displayName };
      }

      const companion: CompanionRecord = {
        personUuid: createdPerson.current.uuid,
        name: createdPerson.current.name,
      };
      await workspaceProps.onCompanionSelected(companion);
      showSnackbar({
        kind: 'success',
        title: t('companionRegistered', 'Acompañante registrado'),
        subtitle: t('companionRegisteredMessage', '{{name}} fue seleccionado para esta consulta.', {
          name: companion.name,
        }),
      });
      await closeWorkspace({ discardUnsavedChanges: true });
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: t('companionSaveError', 'No se pudo guardar el acompañante'),
        subtitle: getUserFacingErrorMessage(
          error,
          t('companionSaveErrorMessage', 'Revise los datos e intente nuevamente.'),
        ),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Workspace2
      hasUnsavedChanges={isDirty || Boolean(createdPerson.current)}
      title={t('registerCompanion', 'Registrar acompañante')}
    >
      <Form className={styles.registrationForm} onSubmit={handleSubmit(onSubmit)}>
        <Stack className={styles.workspaceContent} gap={5}>
          <TextInput
            id="companion-given-name"
            labelText={t('givenName', 'Primer nombre')}
            invalid={Boolean(errors.givenName)}
            invalidText={errors.givenName?.message}
            {...register('givenName')}
          />
          <TextInput
            id="companion-middle-name"
            labelText={t('middleNameOptional', 'Segundo nombre (opcional)')}
            invalid={Boolean(errors.middleName)}
            invalidText={errors.middleName?.message}
            {...register('middleName')}
          />
          <TextInput
            id="companion-family-name"
            labelText={t('familyName', 'Apellido paterno')}
            invalid={Boolean(errors.familyName)}
            invalidText={errors.familyName?.message}
            {...register('familyName')}
          />
          <TextInput
            id="companion-family-name-2"
            labelText={t('familyName2Optional', 'Apellido materno (opcional)')}
            invalid={Boolean(errors.familyName2)}
            invalidText={errors.familyName2?.message}
            {...register('familyName2')}
          />
          <Select
            id="companion-gender"
            labelText={t('sex', 'Sexo')}
            invalid={Boolean(errors.gender)}
            invalidText={errors.gender?.message}
            {...register('gender')}
          >
            <SelectItem disabled value="" text={t('selectOption', 'Seleccione una opción')} />
            <SelectItem value="M" text={t('male', 'Masculino')} />
            <SelectItem value="F" text={t('female', 'Femenino')} />
            <SelectItem value="O" text={t('other', 'Otro')} />
            <SelectItem value="U" text={t('unknown', 'Desconocido')} />
          </Select>
          <TextInput
            id="companion-estimated-age"
            type="number"
            min={workspaceProps.requireAdult ? 18 : 0}
            max={MAX_PATIENT_AGE_YEARS}
            labelText={t('estimatedAge', 'Edad aproximada')}
            invalid={Boolean(errors.estimatedAge)}
            invalidText={errors.estimatedAge?.message}
            {...register('estimatedAge')}
          />
        </Stack>
        <ButtonSet className={styles.workspaceFooter} stacked={false}>
          <Button disabled={isSaving} kind="secondary" onClick={() => closeWorkspace()} type="button">
            {t('cancel', 'Cancelar')}
          </Button>
          <Button disabled={isSaving} kind="primary" type="submit">
            {isSaving ? t('saving', 'Guardando...') : t('saveAndReturn', 'Guardar y regresar')}
          </Button>
        </ButtonSet>
      </Form>
    </Workspace2>
  );
};

export default CompanionPersonRegistrationWorkspace;
