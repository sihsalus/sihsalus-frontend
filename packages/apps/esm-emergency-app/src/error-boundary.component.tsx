import { Button, InlineNotification } from '@carbon/react';
import { getUserFacingErrorMessage } from '@openmrs/esm-framework';
import React, { type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary for the Emergency module.
 * Catches unhandled errors in the component tree and displays
 * a user-friendly error message with a retry option.
 */
class ErrorBoundaryClass extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[EmergencyModule] Unhandled error:', error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  onRetry: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, onRetry }) => {
  const { t } = useTranslation();

  return (
    <div style={{ padding: '1rem' }}>
      <InlineNotification
        kind="error"
        title={t('emergencyModuleError', 'Error en el módulo de emergencias')}
        subtitle={getUserFacingErrorMessage(
          error,
          t(
            'emergencyModuleErrorSubtitle',
            'No se pudo mostrar esta sección de emergencias. Reintente; si el problema continúa, recargue la página o contacte a soporte.',
          ),
          { log: false },
        )}
        lowContrast
        hideCloseButton
      />
      <Button kind="ghost" size="sm" onClick={onRetry} style={{ marginTop: '0.5rem' }}>
        {t('retry', 'Reintentar')}
      </Button>
    </div>
  );
};

export default ErrorBoundaryClass;
