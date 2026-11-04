import classNames from 'classnames';
import React from 'react';

import styles from './card-header-actions.scss';

interface CardHeaderActionsProps {
  status: React.ReactNode;
  action: React.ReactNode;
  showAction: boolean;
}

/** Keeps status content in the same position when its adjacent write action is unavailable. */
export function CardHeaderActions({ status, action, showAction }: CardHeaderActionsProps) {
  return (
    <div className={styles.actions}>
      {status}
      <div
        className={classNames(styles.actionSlot, {
          [styles.hiddenAction]: !showAction,
        })}
        aria-hidden={showAction ? undefined : true}
      >
        {action}
      </div>
    </div>
  );
}
