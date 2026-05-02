'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] bg-[rgba(239,68,68,0.1)]">
          <svg className="h-7 w-7 text-[var(--color-danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--color-text)]">页面加载失败</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">请刷新页面后重试</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-primary)] to-[#059669] px-5 py-2.5 text-sm font-semibold text-[var(--color-text-inverted)] transition-all hover:-translate-y-px hover:shadow-[0_4px_8px_rgba(16,185,129,0.35)]"
        >
          重新加载
        </button>
      </div>
    );
  }
}
