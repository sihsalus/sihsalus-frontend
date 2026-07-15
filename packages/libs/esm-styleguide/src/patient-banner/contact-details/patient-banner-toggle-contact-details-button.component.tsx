/** @module @category UI */

import { Button } from '@carbon/react';
import { getCoreTranslation } from '@openmrs/esm-translations';
import { type MouseEvent } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '../../public';

export interface PatientBannerToggleContactDetailsButtonProps {
  /** Whether the contact details are currently being displayed */
  showContactDetails: boolean;
  /** Function called when this button is clicked. */
  toggleContactDetails: (e: MouseEvent) => void;
  /** Passed through to the Carbon Button component */
  className?: string;
}

export function PatientBannerToggleContactDetailsButton({
  showContactDetails,
  toggleContactDetails,
  className,
}: PatientBannerToggleContactDetailsButtonProps) {
  return (
    <Button
      className={className}
      iconDescription="Toggle contact details"
      kind="ghost"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleContactDetails(event);
      }}
      renderIcon={showContactDetails ? ChevronUpIcon : ChevronDownIcon}
      type="button"
    >
      {showContactDetails ? getCoreTranslation('showLess', 'Show less') : getCoreTranslation('showMore', 'Show more')}
    </Button>
  );
}
