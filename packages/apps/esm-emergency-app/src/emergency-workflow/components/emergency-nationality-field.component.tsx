import { getNationalitySelectionUpdate } from '../patient-nationality';
import type { NationalityConceptAnswer } from '../patient-nationality.resource';
import { NationalityConceptField } from './nationality-concept-field.component';

interface EmergencyNationalityFieldProps {
  disabled?: boolean;
  error?: Error;
  invalidText?: string;
  isLoading: boolean;
  nationalityWasAutoAssigned: { current: boolean };
  onChange: (conceptUuid: string) => void;
  options?: Array<NationalityConceptAnswer>;
  value?: string;
}

export function EmergencyNationalityField({
  disabled,
  error,
  invalidText,
  isLoading,
  nationalityWasAutoAssigned,
  onChange,
  options,
  value,
}: EmergencyNationalityFieldProps) {
  return (
    <NationalityConceptField
      value={value}
      options={options}
      isLoading={isLoading}
      error={error}
      invalidText={invalidText}
      disabled={disabled}
      onChange={(conceptUuid) => {
        const update = getNationalitySelectionUpdate({
          currentNationality: value,
          selectedNationality: conceptUuid,
          wasAutoAssigned: nationalityWasAutoAssigned.current,
        });
        nationalityWasAutoAssigned.current = update.wasAutoAssigned;
        if (update.shouldUpdate) {
          onChange(update.nationality);
        }
      }}
    />
  );
}
