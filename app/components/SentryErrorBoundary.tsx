'use client';

import React from 'react';
import * as Sentry from '@sentry/nextjs';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  eventId: string | null;
}

/**
 * Sentry-aware error boundary. Captures unhandled React render errors
 * and shows a graceful fallback UI.
 */
export default class SentryErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, eventId: null };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const eventId = Sentry.captureException(error, {
      extra: { componentStack: errorInfo.componentStack },
    });
    this.setState({ eventId });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-xl border border-beige bg-cream/30 p-8 text-center">
          <svg
            className="h-10 w-10 text-taupe"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
          <div>
            <p className="font-serif text-lg font-semibold text-dark-brown">
              Something went wrong
            </p>
            <p className="mt-1 text-sm text-taupe">
              An unexpected error occurred. Please refresh the page.
            </p>
            {this.state.eventId && (
              <p className="mt-1 text-xs text-taupe/60">
                Error ID: {this.state.eventId}
              </p>
            )}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-gold px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gold/90"
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
