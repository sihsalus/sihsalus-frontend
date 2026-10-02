import { DecisionTree, Fork, Home, IbmDevopsTest, IbmWatsonStudio, RainDrop } from '@carbon/react/icons';
import {
  ChemistryIcon,
  GroupIcon,
  InventoryManagementIcon,
  MicroscopeIcon,
  MovementIcon,
  SyringeIcon,
  TreeViewAltIcon,
  UserFollowIcon,
} from '@openmrs/esm-framework';
import { describe, expect, it } from 'vitest';

import { bloodBankNavigation } from './blood-bank-navigation';

describe('Blood Bank navigation icons', () => {
  const items = bloodBankNavigation.flatMap((item) => [item, ...(item.children ?? [])]);

  it.each([
    ['/', Home],
    ['/donors', GroupIcon],
    ['/applicant-selection', UserFollowIcon],
    ['/collection', SyringeIcon],
    ['/laboratory', ChemistryIcon],
    ['/laboratory/screening', MicroscopeIcon],
    ['/laboratory/compatibility', IbmDevopsTest],
    ['/laboratory/fractionation', Fork],
    ['/follow-up', TreeViewAltIcon],
    ['/follow-up/donor', IbmWatsonStudio],
    ['/follow-up/recipient', DecisionTree],
    ['/transfers', MovementIcon],
    ['/inventory', InventoryManagementIcon],
    ['/transfusions', RainDrop],
  ])('uses the requested icon for %s', (path, Icon) => {
    expect(items.find((item) => item.path === path)?.icon).toBe(Icon);
  });

  it.each([
    ['/laboratory/screening', 'Tamizaje'],
    ['/follow-up/donor', 'Al donante'],
    ['/follow-up/recipient', 'Al receptor'],
  ])('uses the shorter navigation label for %s', (path, label) => {
    expect(items.find((item) => item.path === path)?.defaultLabel).toBe(label);
  });
});
