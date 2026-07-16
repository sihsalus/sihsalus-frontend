import { Dropdown, InlineLoading, Tile } from '@carbon/react';
import { useLocations } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function WardLocationSelector() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const admissionLocations = useLocations('Admission Location');

  if (!admissionLocations.length) {
    return <InlineLoading description={t('loadingWardLocations', 'Loading ward locations...')} />;
  }

  return (
    <Tile>
      <Dropdown
        id="ward-location-selector"
        items={admissionLocations}
        itemToString={(location) => location?.display ?? location?.name ?? ''}
        label={t('selectWardLocation', 'Select a ward')}
        titleText={t('wardLocation', 'Ward location')}
        onChange={({ selectedItem }) => {
          if (selectedItem?.uuid) {
            navigate(selectedItem.uuid);
          }
        }}
      />
    </Tile>
  );
}
