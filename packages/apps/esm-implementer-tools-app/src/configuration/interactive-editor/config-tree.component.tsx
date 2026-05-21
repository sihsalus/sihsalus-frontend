/* eslint-disable @typescript-eslint/no-explicit-any */
import { Accordion, AccordionItem } from '@carbon/react';
import { useStore } from 'zustand';

import { implementerToolsStore } from '../../store';
import styles from './config-tree.styles.scss';
import { ConfigTreeForModule } from './config-tree-for-module.component';

export interface ConfigTreeProps {
  config: Record<string, any>;
}

export function ConfigTree({ config }: ConfigTreeProps) {
  const { uiSelectedPath } = useStore(implementerToolsStore);
  const focusedModule = uiSelectedPath?.[0];

  return (
    <Accordion align="start">
      {config &&
        Object.keys(config)
          .sort((a, b) => a.localeCompare(b))
          .map((moduleName) => {
            const moduleConfig = config[moduleName];
            return Object.keys(moduleConfig).length ? (
              <AccordionItem
                title={<h6>{moduleName}</h6>}
                className={styles.fullWidthAccordion}
                key={`accordion-${moduleName}`}
                open={focusedModule === moduleName ? true : undefined}
              >
                <ConfigTreeForModule config={moduleConfig} moduleName={moduleName} key={`${moduleName}-config`} />
              </AccordionItem>
            ) : null;
          })}
    </Accordion>
  );
}
