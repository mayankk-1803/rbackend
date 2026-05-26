import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-[2rem] shadow-sm text-[var(--text-primary)]">
          <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-rose-500" />
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] uppercase tracking-tight mb-2">Something went wrong</h2>
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider max-w-xs mb-8">
            Something went wrong. Please refresh and try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-[var(--bg-primary)] rounded-xl text-[10px] font-bold uppercase tracking-wider hover:opacity-90 transition-all cursor-pointer"
          >
            <RefreshCcw className="w-4 h-4" /> Reset Panel
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
