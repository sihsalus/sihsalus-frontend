import { Accordion, AccordionItem } from '@carbon/react';
import { ExtensionSlot } from '@openmrs/esm-framework';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { registerNavGroup } from '..';

export interface DashboardGroupExtensionProps {
  readonly title: string;
  readonly slotName?: string;
  readonly basePath: string;
  readonly isExpanded?: boolean;
}

export const DashboardGroupExtension = ({
  title,
  slotName,
  basePath,
  isExpanded,
}: DashboardGroupExtensionProps): React.JSX.Element => {
  const { t } = useTranslation();
  const navGroupName = slotName ?? title;

  useEffect(() => {
    registerNavGroup(navGroupName);
  }, [navGroupName]);

  return (
    <Accordion>
      <AccordionItem open={isExpanded ?? true} title={t(title)}>
        <ExtensionSlot name={navGroupName} state={{ basePath }} />
      </AccordionItem>
    </Accordion>
  );
};
