import { Button, Tile } from '@carbon/react';
import { ArrowLeft, Locked } from '@carbon/react/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface UnauthorizedStateProps {
  readonly privilege: string | string[];
  readonly description?: string;
  readonly onNavigateBack?: () => void;
}

/**
 * Task-oriented unauthorized fallback. The missing privilege identifier is kept
 * out of the visible copy — it means nothing to the operator — but stays on a
 * data attribute so support can read it from the inspector.
 */
export function UnauthorizedState({
  privilege,
  description,
  onNavigateBack,
}: UnauthorizedStateProps): React.ReactElement {
  const { t } = useTranslation();
  const privilegeLabel = Array.isArray(privilege) ? privilege.join(', ') : privilege;
  const body =
    description ??
    t(
      'unauthorizedStateBody',
      'Su usuario no tiene acceso a esta sección. Si su rol debería incluirla, solicite el acceso al administrador del sistema.',
    );
  const handleNavigateBack = onNavigateBack ?? (() => window.history.back());

  return (
    <Tile data-required-privilege={privilegeLabel}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <Locked size={20} />
        <strong>{t('unauthorizedStateTitle', 'Sección no disponible para su usuario')}</strong>
      </div>
      <p>{body}</p>
      <div style={{ marginTop: '1rem' }}>
        <Button kind="tertiary" size="sm" renderIcon={ArrowLeft} onClick={handleNavigateBack}>
          {t('unauthorizedStateGoBack', 'Volver')}
        </Button>
      </div>
    </Tile>
  );
}
