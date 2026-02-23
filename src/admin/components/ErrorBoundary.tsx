import * as React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const RELOAD_KEY = 'atluf_chunk_reload';
const RELOAD_TIMEOUT = 60000;

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  private static isChunkLoadError(error: Error): boolean {
    const message = error.message || '';
    return (
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('error loading dynamically imported module') ||
      message.includes('Importing a module script failed') ||
      message.includes('Loading chunk') ||
      message.includes('Loading CSS chunk')
    );
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    if (ErrorBoundary.isChunkLoadError(error)) {
      try {
        const lastReload = sessionStorage.getItem(RELOAD_KEY);
        if (!lastReload || (Date.now() - parseInt(lastReload, 10)) >= RELOAD_TIMEOUT) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          window.location.reload();
          return;
        }
      } catch {
        // sessionStorage unavailable — fall through to render UI
      }
    }
  }

  public handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  public render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      if (this.state.error && ErrorBoundary.isChunkLoadError(this.state.error)) {
        return (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-blue-800 font-semibold">Update Available</h3>
                <p className="text-blue-600 text-sm mt-1">
                  A new version of the site has been deployed. Please reload the page to get the latest version.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                try { sessionStorage.removeItem(RELOAD_KEY); } catch {}
                window.location.reload();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              Reload Page
            </button>
          </div>
        );
      }

      return (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-red-800 font-semibold">Something went wrong</h3>
              <p className="text-red-600 text-sm mt-1">
                An error occurred while displaying this content. This may be due to corrupted or missing data.
              </p>
              {this.state.error && (
                <details className="mt-3">
                  <summary className="text-red-500 text-sm cursor-pointer hover:text-red-600">
                    Technical details
                  </summary>
                  <pre className="mt-2 p-3 bg-red-100 rounded-lg text-xs text-red-700 overflow-x-auto">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
            </div>
          </div>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
