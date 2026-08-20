'use client';

import React from 'react';
import { Button } from '@/shared/components/ui/button';

interface ModuleErrorBoundaryProps {
  children: React.ReactNode;
  fallbackLabel?: string;
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface ModuleErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ModuleErrorBoundary extends React.Component<
  ModuleErrorBoundaryProps,
  ModuleErrorBoundaryState
> {
  constructor(props: ModuleErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ModuleErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(
      `[ModuleErrorBoundary] Error in ${this.props.fallbackLabel || 'component'}:`,
      error,
      info.componentStack,
    );
    this.props.onError?.(error, info);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      const label = this.props.fallbackLabel || 'this section';
      return (
        <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Something went wrong loading {label}.
          </p>
          <Button variant="outline" size="sm" onClick={this.handleRetry}>
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
