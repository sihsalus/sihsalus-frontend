type Subscription = {
  uuid: string;
  url: string;
  token: string;
  subscribedToSnapshot?: boolean;
  validationType?: 'NONE' | 'FULL';
};

type Import = {
  uuid: string;
  localDateStarted: Date;
  localDateStopped: Date;
  importTime: string;
  errorMessage: string;
  importProgress: number;
  allItemsCount: number;
  addedItemsCount: number;
  errorItemsCount: number;
  ignoredErrorsCount: number;
  updatedItemsCount: number;
  upToDateItemsCount: number;
  retiredItemsCount: number;
  unretiredItemsCount: number;
  status: string;
};

type ImportItem = {
  uuid: string;
  errorMessage: string;
  type: 'CONCEPT' | 'MAPPING';
  versionUrl: string;
  updatedOn: Date;
  state: 'ADDED' | 'UPDATED' | 'RETIRED' | 'UNRETIRED' | 'ERROR' | 'IGNORED_ERROR' | 'UP_TO_DATE' | 'DUPLICATE';
};

export const mockSubscription: Subscription = {
  uuid: 'subscription-uuid',
  url: 'https://api.openconceptlab.org/orgs/openmrs/collections/demo',
  token: 'token123',
  subscribedToSnapshot: false,
  validationType: 'FULL',
};

export const mockPreviousImports: Import[] = [
  {
    uuid: 'import-uuid-1',
    localDateStarted: new Date('2024-01-01T08:00:00Z'),
    localDateStopped: new Date('2024-01-01T08:10:00Z'),
    importTime: '10m',
    errorMessage: '',
    importProgress: 100,
    allItemsCount: 10,
    addedItemsCount: 3,
    errorItemsCount: 0,
    ignoredErrorsCount: 0,
    updatedItemsCount: 2,
    upToDateItemsCount: 5,
    retiredItemsCount: 0,
    unretiredItemsCount: 0,
    status: 'RUNNING',
  },
  {
    uuid: 'import-uuid-2',
    localDateStarted: new Date('2024-01-02T09:00:00Z'),
    localDateStopped: new Date('2024-01-02T09:12:00Z'),
    importTime: '12m',
    errorMessage: 'Some import errors occurred',
    importProgress: 100,
    allItemsCount: 12,
    addedItemsCount: 4,
    errorItemsCount: 2,
    ignoredErrorsCount: 1,
    updatedItemsCount: 3,
    upToDateItemsCount: 2,
    retiredItemsCount: 1,
    unretiredItemsCount: 0,
    status: 'COMPLETED',
  },
];

export const mockImportItems: ImportItem[] = [
  {
    uuid: 'concept-1',
    errorMessage: 'Concept added',
    type: 'CONCEPT',
    versionUrl: 'https://api.openconceptlab.org/concepts/1',
    updatedOn: new Date('2024-01-02T09:01:00Z'),
    state: 'ADDED',
  },
  {
    uuid: 'mapping-2',
    errorMessage: 'Mapping updated',
    type: 'MAPPING',
    versionUrl: 'https://api.openconceptlab.org/mappings/2',
    updatedOn: new Date('2024-01-02T09:02:00Z'),
    state: 'UPDATED',
  },
  {
    uuid: 'concept-3',
    errorMessage: 'Concept retired',
    type: 'CONCEPT',
    versionUrl: 'https://api.openconceptlab.org/concepts/3',
    updatedOn: new Date('2024-01-02T09:03:00Z'),
    state: 'RETIRED',
  },
  {
    uuid: 'mapping-4',
    errorMessage: 'Concept still up to date',
    type: 'MAPPING',
    versionUrl: 'https://api.openconceptlab.org/mappings/4',
    updatedOn: new Date('2024-01-02T09:04:00Z'),
    state: 'UP_TO_DATE',
  },
  {
    uuid: 'concept-5',
    errorMessage: 'Ignored duplicate',
    type: 'CONCEPT',
    versionUrl: 'https://api.openconceptlab.org/concepts/5',
    updatedOn: new Date('2024-01-02T09:05:00Z'),
    state: 'IGNORED_ERROR',
  },
  {
    uuid: 'mapping-6',
    errorMessage: 'Another mapping error',
    type: 'MAPPING',
    versionUrl: 'https://api.openconceptlab.org/mappings/6',
    updatedOn: new Date('2024-01-02T09:06:00Z'),
    state: 'ERROR',
  },
];
