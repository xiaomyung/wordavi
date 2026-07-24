import { Component, type ErrorInfo, type ReactNode } from 'react';
import { CrashScreen } from '@/screens/CrashScreen';
import { ReportScreen } from '@/screens/ReportScreen';
import { log } from '@/services/log';

const NS = 'app';

export interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  crashed: boolean;
  /** The report screen, opened from the crash screen (the router is gone). */
  reporting: boolean;
}

/**
 * Catches render-phase errors anywhere below it. Runtime errors outside render
 * (event handlers, promises) are picked up by `installGlobalErrorCapture` in
 * bootstrap instead — both funnel into the same log ring the report screen reads.
 *
 * Once crashed, the boundary *is* the app: the whole tree below it is gone, so
 * it renders the crash screen and the report screen itself rather than handing
 * navigation back to a router that no longer exists.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { crashed: false, reporting: false };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { crashed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    log.error(NS, error.message || 'render error', {
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  override render(): ReactNode {
    if (!this.state.crashed) return this.props.children;
    if (this.state.reporting) {
      return <ReportScreen onClose={() => this.setState({ reporting: false })} />;
    }
    return (
      <CrashScreen
        onRestart={() => {
          window.location.reload();
        }}
        onReport={() => this.setState({ reporting: true })}
      />
    );
  }
}
