import { InlineLoading, InlineNotification, Link, ListItem, Tile, UnorderedList } from '@carbon/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useMotherAndChildLinks } from './mother-child-relationships.resource';

export interface MotherChildRelationshipsProps {
  patientUuid: string;
  patientRole: 'mother' | 'child';
  canView: boolean;
  translationNamespace: string;
}

function RelationshipRecords({
  patientUuid,
  patientRole,
  translationNamespace,
}: Omit<MotherChildRelationshipsProps, 'canView'>) {
  const { t } = useTranslation(translationNamespace);
  const { data, error, isLoading } = useMotherAndChildLinks(
    patientRole === 'mother' ? { motherUuid: patientUuid } : { childUuid: patientUuid },
    true,
  );
  const title = t(patientRole === 'mother' ? 'motherChildLinkedChildren' : 'motherChildLinkedMother');
  const relatives = new Map<string, { uuid: string; display?: string }>();
  let invalidResponse = false;
  for (const link of data ?? []) {
    const owner = patientRole === 'mother' ? link?.mother : link?.child;
    const relative = patientRole === 'mother' ? link?.child : link?.mother;
    if (owner?.uuid !== patientUuid || !relative?.uuid || relative.uuid === patientUuid) {
      invalidResponse = true;
    } else {
      relatives.set(relative.uuid, relative);
    }
  }

  return (
    <Tile>
      <h5>{title}</h5>
      <p>{t('motherChildRelationshipHelp')}</p>
      {error || invalidResponse ? (
        <InlineNotification
          kind="error"
          title={t('motherChildRelationshipError')}
          subtitle={t('motherChildRelationshipErrorHelp')}
          hideCloseButton
          lowContrast
        />
      ) : isLoading || data === undefined ? (
        <InlineLoading description={t('motherChildRelationshipLoading')} />
      ) : relatives.size ? (
        <UnorderedList>
          {Array.from(relatives.values()).map(({ uuid, display }) => {
            const name = display?.trim() || t('motherChildNameUnavailable');
            return (
              <ListItem key={uuid}>
                <Link
                  href={`${window.getOpenmrsSpaBase()}patient/${encodeURIComponent(uuid)}/chart`}
                  aria-label={t('motherChildOpenChart', { name })}
                >
                  {name}
                </Link>
              </ListItem>
            );
          })}
        </UnorderedList>
      ) : (
        <p>{t(patientRole === 'mother' ? 'motherChildNoLinkedChildren' : 'motherChildNoLinkedMother')}</p>
      )}
    </Tile>
  );
}

/** The owning clinical view supplies its established read guard before mounting the reader. */
export function MotherChildRelationships(props: MotherChildRelationshipsProps) {
  const patientUuid = props.patientUuid.trim();
  return props.canView && patientUuid ? (
    <RelationshipRecords {...props} patientUuid={patientUuid} key={`${props.patientRole}:${patientUuid}`} />
  ) : null;
}
