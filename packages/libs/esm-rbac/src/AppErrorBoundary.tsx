import { Button, Tile } from '@carbon/react';
import { reportError } from '@openmrs/esm-framework';
import { auditLogger } from '@sihsalus/esm-audit-logger';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  readonly appName: string;
  readonly children: ReactNode;
  readonly loading?: boolean;
  readonly onError?: (error: Error, info: ErrorInfo) => void;
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
