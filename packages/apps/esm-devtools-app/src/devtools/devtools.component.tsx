import { Button } from '@carbon/react';
import classNames from 'classnames';
import { useState } from 'react';
import { type AppProps } from 'single-spa';
import styles from './devtools.styles.scss';
import DevToolsPopup from './devtools-popup.component';
import { importMapOverridden } from './import-map.component';

const LOCAL_DEV_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const showDevTools = () =>
  window.spaEnv === 'development' ||
  (LOCAL_DEV_HOSTS.has(window.location.hostname) && localStorage.getItem('openmrs:devtools') === 'true');

export default function Root(props: AppProps) {
  return showDevTools() ? <DevTools {...props} /> : null;
}

function DevTools(_props: AppProps) {
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const [isOverridden, setIsOverridden] = useState(importMapOverridden);

  const toggleDevTools = () => setDevToolsOpen((devToolsOpen) => !devToolsOpen);
  const toggleOverridden = (overridden: boolean) => setIsOverridden(overridden);

  return (
    <>
      <Button
        className={classNames(styles.devtoolsTriggerButton, {
          [styles.overridden]: isOverridden,
        })}
        kind="ghost"
        onClick={toggleDevTools}
        size="md"
      >
        {'{\u00B7\u00B7\u00B7}'}
      </Button>
      {devToolsOpen && <DevToolsPopup close={toggleDevTools} toggleOverridden={toggleOverridden} />}
    </>
  );
}
