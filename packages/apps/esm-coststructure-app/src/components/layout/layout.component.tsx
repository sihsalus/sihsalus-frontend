import { SideNav, SideNavItems, SideNavLink } from '@carbon/react';
import { Document, DocumentAdd, Report } from '@carbon/react/icons';
import { navigate } from '@openmrs/esm-framework';
import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { baseName } from '../../constants';

import styles from './layout.scss';

const CostStructureLayout: React.FC = () => {
  const location = useLocation();
  const currLocation = location.pathname;
  const handleNavigation = (path: string = '') => navigate({ to: `${baseName}/${path}` });
  return (
    <div className={styles.layout}>
      <section>
        <SideNav>
          <SideNavItems>
            <SideNavLink onClick={() => handleNavigation()} renderIcon={Document} isActive={currLocation === '/'}>
              Estructura de costos
            </SideNavLink>
            <SideNavLink
              onClick={() => handleNavigation('add')}
              renderIcon={DocumentAdd}
              isActive={currLocation === '/add'}
            >
              Añadir
            </SideNavLink>
            <SideNavLink
              onClick={() => handleNavigation('report')}
              renderIcon={Report}
              isActive={currLocation === '/report'}
            >
              Reportes
            </SideNavLink>
          </SideNavItems>
        </SideNav>
      </section>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
};
export default CostStructureLayout;
