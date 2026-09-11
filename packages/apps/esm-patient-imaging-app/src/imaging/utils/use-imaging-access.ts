import { useConnectivity, useSession, userHasAccess } from '@openmrs/esm-framework';
import { imagingEditPrivilege } from '../constants';

interface ImagingAccess {
  canWrite: boolean;
  isOnline: boolean;
  userUuid?: string;
}

/** UI availability follows the registered privilege; API authorization remains authoritative. */
export function useImagingAccess(): ImagingAccess {
  const session = useSession();
  const isOnline = useConnectivity();
  const canWrite = !!session?.authenticated && !!isOnline && userHasAccess(imagingEditPrivilege, session?.user);
  return { canWrite, isOnline: !!isOnline, userUuid: session?.user?.uuid };
}
