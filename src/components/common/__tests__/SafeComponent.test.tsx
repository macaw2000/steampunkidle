/**
 * SafeComponent Tests
 * Tests for the SafeComponent wrapper that catches rendering errors
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import SafeComponent from '../SafeComponent';

// Component that throws an error
const ErrorComponent: React.FC = () => {
  throw new Error('Test error');
};

// Component that works normally
const WorkingComponent: React.FC = () => <div>Working component</div>;

describe('SafeComponent', () => {
  // Suppress console.error for these tests since we're intentionally throwing errors
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it('renders children when no error occurs', () => {
    render(
      <SafeComponent>
        <WorkingComponent />
      </SafeComponent>
    );

    expect(screen.getByText('Working component')).toBeInTheDocument();
  });

  it('renders default error UI when child component throws', () => {
    render(
      <SafeComponent>
        <ErrorComponent />
      </SafeComponent>
    );

    expect(screen.getByText('Component Error')).toBeInTheDocument();
    expect(screen.getByText(/This component encountered an error/)).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    const customFallback = <div>Custom error fallback</div>;

    render(
      <SafeComponent fallback={customFallback}>
        <ErrorComponent />
      </SafeComponent>
    );

    expect(screen.getByText('Custom error fallback')).toBeInTheDocument();
    expect(screen.queryByText('Component Error')).not.toBeInTheDocument();
  });

  it('displays custom error message when provided', () => {
    render(
      <SafeComponent errorMessage="Custom error message">
        <ErrorComponent />
      </SafeComponent>
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  it('calls onError callback when error occurs', () => {
    const onError = jest.fn();

    render(
      <SafeComponent onError={onError}>
        <ErrorComponent />
      </SafeComponent>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    );
  });

  it('shows error details in development mode when showErrorDetails is true', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <SafeComponent showErrorDetails={true}>
        <ErrorComponent />
      </SafeComponent>
    );

    expect(screen.getByText('Error Details')).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('does not show error details in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    render(
      <SafeComponent showErrorDetails={true}>
        <ErrorComponent />
      </SafeComponent>
    );

    expect(screen.queryByText('Error Details')).not.toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });
});