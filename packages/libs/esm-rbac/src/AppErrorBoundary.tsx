import { Button, Tile } from '@carbon/react';
import { Privilege, reportError } from '@openmrs/esm-framework';
import { auditLogger } from '@sihsalus/esm-audit-logger';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { checkRequirePrivilege } from './useRequirePrivilege';

interface AppErrorBoundaryProps {
  readonly appName: string;
  readonly user?: any;
  readonly children: ReactNode;
  readonly checkAccess?: boolean;
  readonly loading?: boolean;
  readonly onError?: (error: Error, info: ErrorInfo) => void;
  // Security Props
  readonly privilegesRequired?: string[];
  readonly privileges?: string[];
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error);
    void auditLogger.log({
      eventType: 'UNHANDLED_ERROR',
      metadata: {
        appName: this.props.appName,
        message: error.message,
        componentStack: info.componentStack ?? '',
      },
    });
    this.props.onError?.(error, info);
  }

  render(): ReactNode {
    if (this.props.checkAccess === true) {
      const authStatus = checkRequirePrivilege(
        this.props.user.user?.privileges ?? ([] as Privilege[]),
        this.props.privilegesRequired ?? ([] as string[]),
        true,
      );
      //console.log("Answer: ",authStatus.status);

      if (authStatus.status === 'unauthorized') {
        return (
          <Tile>
            <p>
              <strong>Access restricted</strong>
            </p>
            <p style={{ color: '#6f6f6f', marginTop: '0.5rem' }}>
              You do not have permission to view {this.props.appName}.
            </p>
          </Tile>
        );
      }
    }

    if (this.state.error) {
      return (
        <Tile>
          <p>
            <strong>An unexpected error occurred in {this.props.appName}.</strong>
          </p>
          <p style={{ color: '#6f6f6f', marginTop: '0.5rem' }}>{this.state.error.message}</p>
          <Button kind="ghost" size="sm" style={{ marginTop: '1rem' }} onClick={() => globalThis.location?.reload()}>
            Reload page
          </Button>
        </Tile>
      );
    }

    return this.props.children;
  }
}
