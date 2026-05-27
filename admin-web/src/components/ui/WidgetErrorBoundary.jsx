import React from 'react';
import { AlertTriangle } from 'lucide-react';

export class WidgetErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`Widget [${this.props.title || 'Unknown'}] crashed:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-5 border border-dashed border-rose-500/30 bg-rose-500/5 rounded-2xl flex flex-col items-center justify-center text-center min-h-[180px]">
          <AlertTriangle className="w-6 h-6 text-rose-500 mb-2" />
          <p className="text-xs font-bold text-[var(--text-primary)]">
            {this.props.title || 'Widget'} Failed
          </p>
          <p className="text-[10px] text-[var(--text-secondary)] mt-1 max-w-[240px]">
            {this.state.error?.message || 'Internal rendering error'}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
