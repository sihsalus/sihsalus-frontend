import { Tag, type TagProps } from '@carbon/react';
import React from 'react';

import { type ConfigConcepts, type Encounter } from '../types';
import { findObs, getObsFromEncounter } from '../utils/helpers';

const getTagText = (value: unknown) => {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && value !== null) {
    const namedValue = value as { display?: string; name?: string | { display?: string; name?: string } };
    if (typeof namedValue.display === 'string') {
      return namedValue.display;
    }
    if (typeof namedValue.name === 'string') {
      return namedValue.name;
    }
    if (typeof namedValue.name === 'object' && namedValue.name !== null) {
      return namedValue.name.display ?? namedValue.name.name ?? '--';
    }
  }

  return '--';
};

export const renderTag = (
  encounter: Encounter,
  concept: string,
  statusColorMappings: Record<string, NonNullable<TagProps<'div'>['type']>>,
  config: ConfigConcepts,
) => {
  const columnStatus = getObsFromEncounter({ encounter: encounter, obsConcept: concept, config: config });
  const columnStatusObs = findObs(encounter, concept);

  if (columnStatus === '--') {
    return '--';
  }

  return (
    <Tag
      type={
        typeof columnStatusObs?.value === 'object' && 'uuid' in columnStatusObs.value
          ? statusColorMappings[columnStatusObs.value.uuid]
          : undefined
      }
      title={getTagText(columnStatus)}
      style={{ minWidth: '80px' }}
    >
      {getTagText(columnStatus)}
    </Tag>
  );
};
