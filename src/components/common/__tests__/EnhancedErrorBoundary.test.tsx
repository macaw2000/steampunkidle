/**
 * Enhanced Error Boundary Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EnhancedErrorBoundary } from '../EnhancedErrorBoundary';
import { ErrorLoggingService } from '../../../services/errorLoggingService';

// Mock the ErrorLoggingService
jest.mock('../../../services/errorLoggingService', () => ({
  ErrorLoggingService: {
    logError: jest.fn().mockResolvedValue('error-123'),
    addBreadcrumb: jest.fn(),
    initialize: jest.fn(),
  },
}));

// Mock DevServiceManager
jest.mock('../../../services/devServiceManager', () => ({
  DevServiceManager: {
    isEnabled: jest.fn().mockReturnValue(true),
  },
}));

// Component that throws an error for testing
const ThrowError: React.FC<{ shouldThrow?: boolean; errorMessage?: string }> = ({ 
  shouldThrow = false, 
  errorMessage = 'Test error' 
}) => {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <div>No error</div>;
};

describe('EnhancedErrorBoundary', () => {
  const mockLogError = ErrorLoggingService.logError as jest.MockedFunction<typeof ErrorLoggingService.logError>;
  const mockAddBreadcrumb = ErrorLoggingService.addBreadcrumb as jest.MockedFunction<typeof ErrorLoggingService.addBreadcrumb>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error for cleaner test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Normal Operation', () => {
    it('renders children when no error occurs', () => {
      render(
        <EnhancedErrorBoundary>
          <ThrowError shouldThrow={false} />
        </EnhancedErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
    });

    it('does not call error logging when no error occurs', () => {
      render(
        <EnhancedErrorBoundary>
          <ThrowError shouldThrow={false} />
        </EnhancedErrorBoundary>
      );

      expect(mockLogError).not.toHaveBeenCalled();
      expect(mockAddBreadcrumb).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('catches and displays error when child component throws', async () => {
      render(
        <EnhancedErrorBoundary componentName="TestComponent">
          <ThrowError shouldThrow={true} errorMessage="Test error message" />
        </EnhancedErrorBoundary>
      );

      expect(screen.getByText('Component Error')).toBeInTheDocument();
      expect(screen.getByText('A component on this page encountered an error.')).toBeInTheDocument();
      expect(screen.getByText('Error: Test error message')).toBeInTheDocument();
    });

    it('logs error with correct context when error occurs', async () => {
      render(
        <EnhancedErrorBoundary componentName="TestComponent" level="section">
          <ThrowError shouldThrow={true} errorMessage="Test error message" />
        </EnhancedErrorBoundary>
      );

      await waitFor(() => {
        expect(mockLogError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Test error message',
          }),
          expect.objectContaining({
            errorBoundary: 'TestComponent',
            additionalData: expect.objectContaining({
              level: 'section',
              retryCount: 0,
            }),
          }),
          'high'
        );
      });
    });

    it('adds breadcrumb when error occurs', async () => {
      render(
        <EnhancedErrorBoundary componentName="TestComponent">
          <ThrowError shouldThrow={true} errorMessage="Test error message" />
        </EnhancedErrorBoundary>
      );

      await waitFor(() => {
        expect(mockAddBreadcrumb).toHaveBeenCalledWith(
          'error-boundary',
          'Error caught in TestComponent',
          'error',
          expect.objectContaining({
            errorMessage: 'Test error message',
          })
        );
      });
    });

    it('calls custom onError handler when provided', async () => {
      const mockOnError = jest.fn();
      
      render(
        <EnhancedErrorBoundary onError={mockOnError}>
          <ThrowError shouldThrow={true} errorMessage=\"Test error message\" />
        </EnhancedErrorBoundary>
      );

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Test error message',
          }),
          expect.objectContaining({
            componentStack: expect.any(String),
          })
        );
      });
    });
  });

  describe('Error Levels', () => {
    it('displays page-level error message', () => {
      render(
        <EnhancedErrorBoundary level=\"page\">
          <ThrowError shouldThrow={true} />
        </EnhancedErrorBoundary>
      );

      expect(screen.getByText('Page Error')).toBeInTheDocument();
      expect(screen.getByText('This page encountered an unexpected error and cannot be displayed.')).toBeInTheDocument();
    });

    it('displays section-level error message', () => {
      render(
        <EnhancedErrorBoundary level=\"section\">
          <ThrowError shouldThrow={true} />
        </EnhancedErrorBoundary>
      );

      expect(screen.getByText('Section Error')).toBeInTheDocument();
      expect(screen.getByText('This section encountered an error and cannot be displayed.')).toBeInTheDocument();
    });

    it('displays component-level error message by default', () => {
      render(
        <EnhancedErrorBoundary>
          <ThrowError shouldThrow={true} />
        </EnhancedErrorBoundary>
      );

      expect(screen.getByText('Component Error')).toBeInTheDocument();
      expect(screen.getByText('A component on this page encountered an error.')).toBeInTheDocument();
    });
  });

  describe('Recovery Actions', () => {
    it('displays retry button when recovery is enabled', () => {
      render(
        <EnhancedErrorBoundary enableRecovery={true}>
          <ThrowError shouldThrow={true} />
        </EnhancedErrorBoundary>
      );

      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('does not display retry button when recovery is disabled', () => {
      render(
        <EnhancedErrorBoundary enableRecovery={false}>
          <ThrowError shouldThrow={true} />
        </EnhancedErrorBoundary>
      );

      expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
    });

    it('displays report button when reporting is enabled', () => {
      render(
        <EnhancedErrorBoundary enableReporting={true}>
          <ThrowError shouldThrow={true} />
        </EnhancedErrorBoundary>
      );

      expect(screen.getByText('Report Issue')).toBeInTheDocument();
    });

    it('does not display report button when reporting is disabled', () => {
      render(
        <EnhancedErrorBoundary enableReporting={false}>
          <ThrowError shouldThrow={true} />
        </EnhancedErrorBoundary>
      );

      expect(screen.queryByText('Report Issue')).not.toBeInTheDocument();
    });

    it('always displays reload and go home buttons', () => {
      render(
        <EnhancedErrorBoundary>
          <ThrowError shouldThrow={true} />
        </EnhancedErrorBoundary>
      );

      expect(screen.getByText('Reload Page')).toBeInTheDocument();
      expect(screen.getByText('Go Home')).toBeInTheDocument();
    });
  });

  describe('Error Details', () => {
    it('shows details when show details button is clicked', async () => {
      render(
        <EnhancedErrorBoundary componentName=\"TestComponent\">
          <ThrowError shouldThrow={true} errorMessage=\"Test error message\" />
        </EnhancedErrorBoundary>
      );

      const showDetailsButton = screen.getByText('Show Details');
      fireEvent.click(showDetailsButton);

      await waitFor(() => {
        expect(screen.getByText('Technical Details')).toBeInTheDocument();
        expect(screen.getByText('Error Type:')).toBeInTheDocument();
        expect(screen.getByText('Message:')).toBeInTheDocument();
        expect(screen.getByText('Component:')).toBeInTheDocument();
      });
    });

    it('hides details when hide details button is clicked', async () => {
      render(
        <EnhancedErrorBoundary componentName=\"TestComponent\">
          <ThrowError shouldThrow={true} errorMessage=\"Test error message\" />
        </EnhancedErrorBoundary>
      );

      // Show details first
      const showDetailsButton = screen.getByText('Show Details');
      fireEvent.click(showDetailsButton);

      await waitFor(() => {
        expect(screen.getByText('Technical Details')).toBeInTheDocument();
      });

      // Hide details
      const hideDetailsButton = screen.getByText('Hide Details');
      fireEvent.click(hideDetailsButton);

      await waitFor(() => {
        expect(screen.queryByText('Technical Details')).not.toBeInTheDocument();
      });
    });
  });

  describe('Retry Functionality', () => {
    it('retries rendering when retry button is clicked', async () => {
      let shouldThrow = true;
      const TestComponent = () => <ThrowError shouldThrow={shouldThrow} />;

      const { rerender } = render(
        <EnhancedErrorBoundary>
          <TestComponent />
        </EnhancedErrorBoundary>
      );

      // Error should be displayed
      expect(screen.getByText('Component Error')).toBeInTheDocument();

      // Fix the error condition
      shouldThrow = false;

      // Click retry
      const retryButton = screen.getByText('Try Again');
      fireEvent.click(retryButton);

      // Wait for retry to complete
      await waitFor(() => {
        expect(screen.getByText('Retrying...')).toBeInTheDocument();
      });

      // Rerender with fixed component
      rerender(
        <EnhancedErrorBoundary>
          <TestComponent />
        </EnhancedErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.queryByText('Component Error')).not.toBeInTheDocument();
      });
    });

    it('disables retry button after maximum attempts', async () => {
      render(
        <EnhancedErrorBoundary>
          <ThrowError shouldThrow={true} />
        </EnhancedErrorBoundary>
      );

      const retryButton = screen.getByText('Try Again');

      // Click retry 3 times (maximum)
      for (let i = 0; i < 3; i++) {
        fireEvent.click(retryButton);
        await waitFor(() => {
          expect(screen.getByText('Retrying...')).toBeInTheDocument();
        });
        await waitFor(() => {
          expect(screen.queryByText('Retrying...')).not.toBeInTheDocument();
        });
      }

      // Retry button should be gone after max attempts
      await waitFor(() => {
        expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
      });
    });

    it('adds breadcrumb for retry attempts', async () => {
      render(
        <EnhancedErrorBoundary>
          <ThrowError shouldThrow={true} />
        </EnhancedErrorBoundary>
      );

      const retryButton = screen.getByText('Try Again');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(mockAddBreadcrumb).toHaveBeenCalledWith(
          'error-boundary',
          'Retry attempt 1',
          'info'
        );
      });
    });
  });

  describe('Custom Fallback', () => {
    it('renders custom fallback when provided', () => {
      const customFallback = <div>Custom error message</div>;

      render(
        <EnhancedErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </EnhancedErrorBoundary>
      );

      expect(screen.getByText('Custom error message')).toBeInTheDocument();
      expect(screen.queryByText('Component Error')).not.toBeInTheDocument();
    });
  });

  describe('Report Error', () => {
    it('reports error when report button is clicked', async () => {
      render(
        <EnhancedErrorBoundary enableReporting={true}>
          <ThrowError shouldThrow={true} errorMessage=\"Test error message\" />
        </EnhancedErrorBoundary>
      );

      const reportButton = screen.getByText('Report Issue');
      fireEvent.click(reportButton);

      await waitFor(() => {
        expect(mockLogError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Test error message',
          }),
          expect.objectContaining({
            additionalData: expect.objectContaining({
              userInitiated: true,
            }),
          }),
          'medium'
        );
      });
    });
  });

  describe('Navigation Actions', () => {
    const originalLocation = window.location;

    beforeAll(() => {
      delete (window as any).location;
      window.location = { ...originalLocation, reload: jest.fn(), href: '' };
    });

    afterAll(() => {
      window.location = originalLocation;
    });

    it('reloads page when reload button is clicked', () => {
      render(
        <EnhancedErrorBoundary>
          <ThrowError shouldThrow={true} />
        </EnhancedErrorBoundary>
      );

      const reloadButton = screen.getByText('Reload Page');
      fireEvent.click(reloadButton);

      expect(window.location.reload).toHaveBeenCalled();
      expect(mockAddBreadcrumb).toHaveBeenCalledWith(
        'error-boundary',
        'User initiated page reload',
        'info'
      );
    });

    it('navigates to home when go home button is clicked', () => {
      render(
        <EnhancedErrorBoundary>
          <ThrowError shouldThrow={true} />
        </EnhancedErrorBoundary>
      );

      const goHomeButton = screen.getByText('Go Home');
      fireEvent.click(goHomeButton);

      expect(window.location.href).toBe('/');
      expect(mockAddBreadcrumb).toHaveBeenCalledWith(
        'error-boundary',
        'User navigated to home',
        'info'
      );
    });
  });
});