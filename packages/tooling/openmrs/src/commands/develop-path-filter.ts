import { isSpaIndexRequestPath } from '../../spa-static-options';

export function shouldProxyApiRequest(requestPath: string, apiUrl: string, spaPath: string): boolean {
  return requestPath.startsWith(`${apiUrl}/`) && !isSpaIndexRequestPath(requestPath, spaPath);
}
