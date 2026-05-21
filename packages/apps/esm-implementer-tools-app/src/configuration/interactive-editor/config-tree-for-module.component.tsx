/* eslint-disable @typescript-eslint/no-explicit-any */
import { pickBy } from 'lodash-es';

import { ConfigSubtree } from './config-subtree.component';
import { ExtensionSlotsConfigTree } from './extension-slots-config-tree';
import { TreeContainer } from './layout/tree-container.component';

export interface ConfigTreeForModuleProps {
  config: Record<string, any>;
  moduleName: string;
}

export function ConfigTreeForModule({ config, moduleName }: ConfigTreeForModuleProps) {
  return (
    <TreeContainer>
      <ExtensionSlotsConfigTree extensionsConfig={config.extensionSlots} moduleName={moduleName} />
      <ConfigSubtree config={pickBy(config, (_v, key) => key !== 'extensionSlots')} path={[moduleName]} />
    </TreeContainer>
  );
}
