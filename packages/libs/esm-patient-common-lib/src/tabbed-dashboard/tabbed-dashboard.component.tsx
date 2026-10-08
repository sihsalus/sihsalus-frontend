// ../ui/tabbed-dashboard/tabbed-dashboard.component.tsx
import { Layer, Tab, TabList, TabPanel, TabPanels, Tabs, Tile } from '@carbon/react';
import { Extension, ExtensionSlot } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './tabbed-dashboard.scss';

export type TabConfig = {
  id?: string;
  labelKey: string;
  icon: React.ComponentType;
} & ({ slotName: string; content?: never } | { slotName?: never; content: React.ReactNode });

interface TabbedDashboardProps {
  patient: fhir.Patient;
  patientUuid: string;
  titleKey: string;
  tabs: TabConfig[];
  ariaLabelKey: string;
  translationNamespace?: string;
  pageSize?: number;
  className?: string;
  state?: Record<string, unknown>;
  headerActions?: React.ReactNode;
  descriptionKey?: string;
  selectedTabId?: string;
  onTabChange?: (id: string) => void;
  mountActiveTabOnly?: boolean;
}

const TabbedDashboard: React.FC<TabbedDashboardProps> = ({
  patient,
  patientUuid,
  titleKey,
  tabs,
  ariaLabelKey,
  translationNamespace,
  pageSize = 5,
  className,
  state = {},
  headerActions,
  descriptionKey,
  selectedTabId,
  onTabChange,
  mountActiveTabOnly = false,
}) => {
  const { t } = useTranslation(translationNamespace);
  const [selection, setSelection] = useState<{ patientUuid: string; tabId: string } | null>(null);

  const translatedTabs = useMemo(
    () => tabs.map((tab) => ({ ...tab, id: tab.id ?? tab.slotName ?? tab.labelKey, label: t(tab.labelKey) })),
    [tabs, t],
  );
  const activeTabId = selectedTabId ?? (selection?.patientUuid === patientUuid ? selection.tabId : undefined);
  const selectedIndex = Math.max(
    0,
    translatedTabs.findIndex((tab) => tab.id === activeTabId),
  );

  if (!translatedTabs.length) {
    return null;
  }

  return (
    <div className={classNames(styles.widgetCard, className, { [styles.activeOnly]: mountActiveTabOnly })}>
      <Layer>
        <Tile>
          <div className={classNames(styles.desktopHeading, { [styles.headerWithActions]: headerActions })}>
            <div>
              <h4>{t(titleKey)}</h4>
              {descriptionKey ? <p className={styles.description}>{t(descriptionKey)}</p> : null}
            </div>
            {headerActions ? <div className={styles.headerActions}>{headerActions}</div> : null}
          </div>
        </Tile>
      </Layer>
      <Layer>
        <Tabs
          selectedIndex={selectedIndex}
          onChange={({ selectedIndex: nextIndex }) => {
            const tabId = translatedTabs[nextIndex]?.id;
            if (tabId) {
              setSelection({ patientUuid, tabId });
              onTabChange?.(tabId);
            }
          }}
        >
          <TabList
            className={styles.tabList}
            activation={mountActiveTabOnly ? 'manual' : 'automatic'}
            aria-label={t(ariaLabelKey)}
          >
            {translatedTabs.map((tab) => (
              <Tab className={styles.tab} key={tab.id} renderIcon={tab.icon}>
                {tab.label}
              </Tab>
            ))}
          </TabList>
          <TabPanels>
            {translatedTabs.map((tab, index) => (
              <TabPanel key={tab.id} className={styles.dashboardContainer}>
                {!mountActiveTabOnly || selectedIndex === index ? (
                  tab.slotName ? (
                    <div key={patientUuid} className={styles.dashboardContainer}>
                      <ExtensionSlot key={tab.slotName} name={tab.slotName} className={styles.dashboard}>
                        {(extension) => (
                          <div className={styles.extension}>
                            <Extension
                              state={{
                                patient,
                                patientUuid,
                                pageSize,
                                extensionId: extension.id,
                                ...state, // Merge custom state
                              }}
                              className={styles.extensionWrapper}
                            />
                          </div>
                        )}
                      </ExtensionSlot>
                    </div>
                  ) : (
                    <div key={patientUuid}>{tab.content}</div>
                  )
                ) : null}
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      </Layer>
    </div>
  );
};

export default TabbedDashboard;
