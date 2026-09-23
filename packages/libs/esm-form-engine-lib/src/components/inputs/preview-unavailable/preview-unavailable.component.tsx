import { useTranslation } from 'react-i18next';
import { type FormFieldInputProps } from '../../../types';
import FieldLabel from '../../field-label/field-label.component';

export default function PreviewUnavailable({ field }: FormFieldInputProps) {
  const { t } = useTranslation();
  return (
    <div>
      <FieldLabel field={field} />
      <p role="note">
        {t('previewActionUnavailable', 'This action or custom control is not available in the schema preview.')}
      </p>
    </div>
  );
}
