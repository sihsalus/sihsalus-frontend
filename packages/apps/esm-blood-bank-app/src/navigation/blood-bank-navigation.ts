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
import { bloodBankPrivileges, type BloodBankPrivilege } from '../access/blood-bank-privileges';

export interface NavigationItem {
  labelKey: string;
  defaultLabel: string;
  path: string;
  privilege: BloodBankPrivilege;
  icon?: typeof Home | typeof GroupIcon;
  children?: NavigationItem[];
}

export const bloodBankNavigation: NavigationItem[] = [
  { labelKey: 'home', defaultLabel: 'Inicio', path: '/', privilege: bloodBankPrivileges.module, icon: Home },
  { labelKey: 'donors', defaultLabel: 'Donantes', path: '/donors', privilege: bloodBankPrivileges.donors, icon: GroupIcon },
  { labelKey: 'applicantSelection', defaultLabel: 'Selección del postulante', path: '/applicant-selection', privilege: bloodBankPrivileges.applicantSelection, icon: UserFollowIcon },
  { labelKey: 'collectionAndApheresis', defaultLabel: 'Extracción y aféresis', path: '/collection', privilege: bloodBankPrivileges.collection, icon: SyringeIcon },
  {
    labelKey: 'laboratory',
    defaultLabel: 'Laboratorio',
    path: '/laboratory',
    privilege: bloodBankPrivileges.screening,
    icon: ChemistryIcon,
    children: [
      { labelKey: 'screeningNav', defaultLabel: 'Tamizaje', path: '/laboratory/screening', privilege: bloodBankPrivileges.screening, icon: MicroscopeIcon },
      { labelKey: 'compatibility', defaultLabel: 'Compatibilidad', path: '/laboratory/compatibility', privilege: bloodBankPrivileges.compatibility, icon: IbmDevopsTest },
      { labelKey: 'fractionation', defaultLabel: 'Fraccionamiento', path: '/laboratory/fractionation', privilege: bloodBankPrivileges.fractionation, icon: Fork },
    ],
  },
  {
    labelKey: 'followUps',
    defaultLabel: 'Seguimientos',
    path: '/follow-up',
    privilege: bloodBankPrivileges.donorFollowUp,
    icon: TreeViewAltIcon,
    children: [
      { labelKey: 'donorFollowUpNav', defaultLabel: 'Al donante', path: '/follow-up/donor', privilege: bloodBankPrivileges.donorFollowUp, icon: IbmWatsonStudio },
      { labelKey: 'recipientFollowUpNav', defaultLabel: 'Al receptor', path: '/follow-up/recipient', privilege: bloodBankPrivileges.recipientFollowUp, icon: DecisionTree },
    ],
  },
  { labelKey: 'transfers', defaultLabel: 'Transferencias', path: '/transfers', privilege: bloodBankPrivileges.transfers, icon: MovementIcon },
  { labelKey: 'inventory', defaultLabel: 'Inventario', path: '/inventory', privilege: bloodBankPrivileges.inventory, icon: InventoryManagementIcon },
  { labelKey: 'transfusions', defaultLabel: 'Transfusiones', path: '/transfusions', privilege: bloodBankPrivileges.transfusions, icon: RainDrop },
];
