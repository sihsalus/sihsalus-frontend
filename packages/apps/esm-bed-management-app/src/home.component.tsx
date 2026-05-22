import React from 'react';
import Header from './header/header.component';
import styles from './home.scss';
import BedManagementSummary from './summary/summary.component';

const Home: React.FC = () => {
  return (
    <section className={styles.section}>
      <Header title="bedManagement" />
      <BedManagementSummary />
    </section>
  );
};

export default Home;
