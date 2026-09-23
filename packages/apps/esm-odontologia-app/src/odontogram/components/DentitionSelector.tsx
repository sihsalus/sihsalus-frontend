import { Select, SelectItem, Tag } from '@carbon/react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { adultConfig } from '../config/adultConfig';
import { childConfig } from '../config/childConfig';
import { hasOdontogramEntries } from '../config/dentition';
import { useOdontogramContext } from '../providers/OdontogramProvider';
import { createEmptyOdontogramData, type OdontogramData } from '../types/odontogram';

interface DentitionSelectorProps {
  allowChange: boolean;
  onChange: (data: OdontogramData) => void;
}

export default function DentitionSelector({ allowChange, onChange }: DentitionSelectorProps) {
  const { t } = useTranslation();
  const id = useId();
  const { config, data, readOnly, formActions } = useOdontogramContext();
  const permanentLabel = t('permanentDentition', 'Permanent dentition (32 teeth)');
  const primaryLabel = t('primaryDentition', 'Primary dentition (20 teeth)');
  const hasEntries = hasOdontogramEntries(data);

  if (readOnly || !allowChange) {
    return <Tag>{config.type === 'child' ? primaryLabel : permanentLabel}</Tag>;
  }

  return (
    <Select
      id={`odontogram-dentition-${id}`}
      labelText={t('dentition', 'Dentition')}
      value={config.type}
      disabled={hasEntries}
      helperText={
        hasEntries
          ? t('dentitionHasEntries', 'The dentition cannot change while this odontogram contains clinical data.')
          : t('chooseDentition', 'Choose the dentition before recording findings. It will be preserved when saved.')
      }
      onChange={(event) => {
        if (hasEntries || event.target.value === config.type) return;
        const nextConfig = event.target.value === 'child' ? childConfig : adultConfig;
        formActions.resetSelection();
        onChange(createEmptyOdontogramData(nextConfig));
      }}
    >
      <SelectItem value="adult" text={permanentLabel} />
      <SelectItem value="child" text={primaryLabel} />
    </Select>
  );
}
