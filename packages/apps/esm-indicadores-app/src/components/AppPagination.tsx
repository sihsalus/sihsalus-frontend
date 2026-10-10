import { Pagination as CarbonPagination, type PaginationProps } from '@carbon/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Carbon `Pagination` with the module's translated labels pre-wired, so the
 * "items per page" / range strings are not left in Carbon's English defaults.
 */
const AppPagination: React.FC<PaginationProps> = (props) => {
  const { t } = useTranslation();

  return (
    <CarbonPagination
      itemsPerPageText={t('itemsPerPage', 'Elementos por página:')}
      itemRangeText={(min, max, total) =>
        t('itemRangeText', '{{min}}–{{max}} de {{total}} elementos', { min, max, total })
      }
      pageRangeText={(_, total) => t('pageRangeText', 'de {{total}} páginas', { total })}
      backwardText={t('previousPage', 'Página anterior')}
      forwardText={t('nextPage', 'Página siguiente')}
      {...props}
    />
  );
};

export default AppPagination;
