import { SwitcherItem } from '@carbon/react';
import { UserAvatarIcon, useSession } from '@openmrs/esm-framework';
import React from 'react';

const UserPanelSwitcher: React.FC = () => {
  const session = useSession();
  const userDisplay = session?.user?.person?.display ?? session?.user?.display ?? session?.user?.username ?? '';
  return (
    <SwitcherItem aria-label="User">
      <UserAvatarIcon size={20} />
      <p>{userDisplay}</p>
    </SwitcherItem>
  );
};

export default UserPanelSwitcher;
