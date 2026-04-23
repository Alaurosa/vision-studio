import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center px-6">
          <div className="max-w-md text-center">
            <div className="w-16 h-16 mx-auto mb-8 rounded-full bg-sienna-500/10 grid place-items-center">
              <span className="text-2xl">⚠</span>
            </div>
            <h2 className="display-md mb-4">Something went wrong</h2>
            <p className="text-ink-600 text-sm leading-relaxed mb-8">
              An unexpected error occurred. This has been logged automatically.
              Please try refreshing the page.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="btn-ink"
              >
                Refresh Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="btn-ghost"
              >
                Try Again
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="mt-8 text-left text-xs text-red-600 bg-red-50 p-4 rounded-lg overflow-auto max-h-40">
                {this.state.error.toString()}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
