import { formatDate, useSession } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './printable-transaction-footer.scss';

type PrintableFooterProps = {
  title: string;
};

const PrintableTransactionFooter: React.FC<PrintableFooterProps> = ({ title }) => {
  const { t } = useTranslation();
  const session = useSession();

  return (
    <div className={styles.container}>
      <p className={styles.itemFooter}>{title}</p>
      <p className={styles.footDescription}>
        {t(
          'generatedMessage',
          'The card has been electronically generated and is a valid document. It was created by {{userName}} on {{date}}',
          {
            userName: `${session?.user?.display}`,
            // date: dayjs().format('DD-MM-YYYY'),
            // time: dayjs().format('hh:mm A'),
            date: `${formatDate(new Date(), { mode: 'standard', noToday: true })}`,
          },
        )}
      </p>
    </div>
  );
};

export default PrintableTransactionFooter;
