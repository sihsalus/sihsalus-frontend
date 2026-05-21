import { ErrorState } from '@openmrs/esm-framework';
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  headerTitle: string;
}

interface State {
  error: Error | null;
}

class OclErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <ErrorState headerTitle={this.props.headerTitle} error={this.state.error} />;
    }
    return this.props.children;
  }
}

export default OclErrorBoundary;
