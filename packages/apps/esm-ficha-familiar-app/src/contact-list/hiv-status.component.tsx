import { SkeletonText } from '@carbon/react';
import React from 'react';
import useRelativeHivEnrollment from '../hooks/useRelativeHivEnrollment';
import useRelativeHTSEncounter from '../hooks/useRelativeHTSEncounter';

import { useLocalizedHivStatus } from './contact-list.resource';

interface HIVStatusProps {
  relativeUuid: string;
}

const HIVStatus: React.FC<HIVStatusProps> = ({ relativeUuid }) => {
  const { enrollment, isLoading } = useRelativeHivEnrollment(relativeUuid);
  const { encounters, isLoading: encounterLoading } = useRelativeHTSEncounter(relativeUuid);
  const { localizedStatus } = useLocalizedHivStatus(encounters ?? [], enrollment);

  if (isLoading || encounterLoading) {
    return <SkeletonText />;
  }
  return <div>{localizedStatus}</div>;
};

export default HIVStatus;
