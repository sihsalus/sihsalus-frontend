import { Button, Pagination, Search } from '@carbon/react';
import { Add, Filter, WhitePaper } from '@carbon/react/icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import HomeTable from '../../components/tables/home/table.component';
import PageHeader from '../../components/ui/PageHeader/pageHeader';
import useGetCostStructure from '../../hooks/use-get-coststructure';

import styles from './styles.scss';

const CostStructureSearch: React.FC = () => {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [query, setQuery] = useState('');
  const { costStructure, total, isLoading, isError } = useGetCostStructure(page - 1, size, query);
  const { t } = useTranslation();

  if (isLoading) return <p>{t('loadingCostStructures', 'Loading cost structures...')}</p>;
  if (isError) return <p>{t('errorLoadingCostStructures', 'Error loading cost structures.')}</p>;

  return (
    <div>
      <PageHeader
        icon={<WhitePaper size={48} />}
        title={t('costStructureCpms', 'Cost Structure – CPMS')}
        subtitle={t('costing', 'Costing')}
      />
      <article className={styles.card}>
        <div className={styles.container}>
          <h3>{t('savedProcedureCosting', 'Saved Procedure Costing')}</h3>
          <Button renderIcon={Add}>{t('add', 'Add')}</Button>
        </div>
        <div>
          <div className={styles.search}>
            <Search
              labelText={t('searchCostStructures', 'Buscar estructuras de costo')}
              placeholder={t('searchPlaceholder', 'E.g.: 00906 or Anesthesia for vulvectomy')}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
            <Button hasIconOnly kind="ghost" renderIcon={Filter} iconDescription={t('filter', 'Filter')} />
          </div>
          <HomeTable data={costStructure} />
          <Pagination
            page={page}
            pageSize={size}
            totalItems={total}
            pageSizes={[5, 10, 20, 50]}
            onChange={({ page, pageSize }) => {
              setPage(page);
              setSize(pageSize);
            }}
          />
        </div>
      </article>
    </div>
  );
};

export default CostStructureSearch;
