import {
  ExtensionSlot,
  isDesktop,
  useConfig,
  useLayoutType,
  useLeftNav,
  WorkspaceContainer,
} from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import classNames from 'classnames';
import { type PharmacyConfig } from './config-schema';
import { dispensingPrivilege } from './constants';
import styles from './dispensing.scss';

export default function Dispensing() {
  const { leftNavMode } = useConfig<PharmacyConfig>();
  const layout = useLayoutType();

  const basePath = globalThis.spaBase + '/dispensing';
  useLeftNav({ name: 'homepage-dashboard-slot', basePath, mode: leftNavMode });

  return (
    <RequirePrivilege privilege={dispensingPrivilege}>
      <div
        className={classNames([
          isDesktop(layout) ? styles.desktopContainer : '',
          leftNavMode === 'normal' ? styles.hasLeftNav : '',
        ])}
      >
        <ExtensionSlot name="dispensing-dashboard-slot" />
        <WorkspaceContainer key="dispensing" contextKey="dispensing" />
      </div>
    </RequirePrivilege>
  );
}
