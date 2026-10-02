import { Outlet } from 'react-router-dom';
import styles from '../styles/app.scss';

export function BloodBankLayout() {
  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
