/**
 * Safe Component Example
 * Demonstrates how to use all the safe component rendering utilities
 */

import React, { useState, useEffect } from 'react';
import {
  SafeComponent,
  LoadingStateManager,
  useLoadingState,
  ServiceUnavailableFallback,
  AuthServiceFallback,
  LoadingFallback,
  EmptyStateFallback,
  withServiceFallback
} from '../common/SafeComponentUtils';
import {
  renderIf,
  renderWithFallback,
  renderFeature,
  renderWithServices,
  renderAsyncState,
  renderIfExists
} from '../../utils/renderingHelpers';

// Example component that might throw an error
const PotentiallyErrorComponent: React.FC<{ shouldError: boolean }> = ({ shouldError }) => {
  if (shouldError) {
    throw new Error('Example component error');
  }
  return <div>✅ Component rendered successfully!</div>;
};

// Example async data component
const AsyncDataComponent: React.FC = () => {
  const loadingState = useLoadingState(true);

  useEffect(() => {
    // Simulate async data loading
    const timer = setTimeout(() => {
      if (Math.random() > 0.3) {
        loadingState.setData({ message: 'Data loaded successfully!' });
      } else {
        loadingState.setError('Failed to load data');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {renderAsyncState(
        loadingState,
        {
          loading: <LoadingFallback message="Loading data..." />,
          error: (error) => <div style={{ color: 'red' }}>❌ {String(error)}</div>,
          success: (data) => <div style={{ color: 'green' }}>✅ {data.message}</div>,
          empty: <EmptyStateFallback title="No data" message="No data available" />
        }
      )}
    </>
  );
};

// Example service-dependent component
const ServiceDependentComponent: React.FC = () => {
  return (
    <>
      {renderWithServices(
        ['auth', 'storage'],
        <div>🔐 Authenticated component with storage access</div>,
        <ServiceUnavailableFallback
          serviceName="Required Services"
          message="This component requires authentication and storage services."
        />
      )}
    </>
  );
};

// Component wrapped with service fallback HOC
const DatabaseComponent: React.FC = () => (
  <div>💾 Database component working!</div>
);

const SafeDatabaseComponent = withServiceFallback(
  DatabaseComponent,
  'Database',
  () => true // Simulate database availability
);

// Main example component
export const SafeComponentExample: React.FC = () => {
  const [showError, setShowError] = useState(false);
  const [userData, setUserData] = useState<{ profile?: { name: string } } | null>(null);

  useEffect(() => {
    // Simulate user data loading
    setTimeout(() => {
      setUserData({ profile: { name: 'John Doe' } });
    }, 1000);
  }, []);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>Safe Component Rendering Examples</h2>
      
      {/* Basic SafeComponent usage */}
      <section style={{ marginBottom: '30px' }}>
        <h3>1. Basic SafeComponent with Error Handling</h3>
        <button onClick={() => setShowError(!showError)}>
          {showError ? 'Fix Component' : 'Break Component'}
        </button>
        
        <SafeComponent
          errorMessage="This component failed to render properly."
          showErrorDetails={true}
        >
          <PotentiallyErrorComponent shouldError={showError} />
        </SafeComponent>
      </section>

      {/* Conditional rendering */}
      <section style={{ marginBottom: '30px' }}>
        <h3>2. Conditional Rendering</h3>
        {renderIf(true, <div>✅ This is always shown</div>)}
        {renderIf(false, <div>❌ This is never shown</div>)}
        {renderIf(() => new Date().getHours() > 12, <div>🌅 Good afternoon!</div>)}
      </section>

      {/* Feature rendering */}
      <section style={{ marginBottom: '30px' }}>
        <h3>3. Feature-based Rendering</h3>
        {renderFeature('chat', <div>💬 Chat feature is enabled</div>)}
        {renderFeature('unknown-feature', 
          <div>❓ Unknown feature</div>, 
          <div>⚠️ Feature not available</div>
        )}
      </section>

      {/* Service-dependent rendering */}
      <section style={{ marginBottom: '30px' }}>
        <h3>4. Service-dependent Rendering</h3>
        <ServiceDependentComponent />
      </section>

      {/* Async state rendering */}
      <section style={{ marginBottom: '30px' }}>
        <h3>5. Async State Management</h3>
        <LoadingStateManager
          initialLoading={false}
          loadingComponent={<LoadingFallback message="Initializing..." />}
          errorComponent={(error, retry) => (
            <div>
              <div style={{ color: 'red' }}>❌ {String(error)}</div>
              <button onClick={retry}>Retry</button>
            </div>
          )}
        >
          {(state, actions) => (
            <div>
              <button onClick={() => actions.setLoading(true)}>Start Loading</button>
              <button onClick={() => actions.setError('Test error')}>Trigger Error</button>
              <button onClick={() => actions.setData('Success!')}>Set Success</button>
              <button onClick={() => actions.reset()}>Reset</button>
              
              <div style={{ marginTop: '10px' }}>
                Status: {state.loading ? 'Loading...' : state.error ? 'Error' : state.data ? 'Success' : 'Ready'}
              </div>
            </div>
          )}
        </LoadingStateManager>
      </section>

      {/* Async data component */}
      <section style={{ marginBottom: '30px' }}>
        <h3>6. Async Data Component</h3>
        <AsyncDataComponent />
      </section>

      {/* Nested property rendering */}
      <section style={{ marginBottom: '30px' }}>
        <h3>7. Nested Property Rendering</h3>
        {renderIfExists(
          userData,
          'profile.name',
          (name: string) => <div>👤 Welcome, {name}!</div>,
          <div>👤 Loading user profile...</div>
        )}
      </section>

      {/* Service fallback HOC */}
      <section style={{ marginBottom: '30px' }}>
        <h3>8. Service Fallback HOC</h3>
        <SafeDatabaseComponent />
      </section>

      {/* Fallback components showcase */}
      <section style={{ marginBottom: '30px' }}>
        <h3>9. Fallback Components</h3>
        
        <div style={{ marginBottom: '15px' }}>
          <h4>Auth Service Fallback:</h4>
          <AuthServiceFallback />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <h4>Loading Fallback:</h4>
          <LoadingFallback message="Loading your data..." />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <h4>Empty State Fallback:</h4>
          <EmptyStateFallback
            title="No items found"
            message="Try adding some items to get started."
            action={{
              label: "Add Item",
              onClick: () => alert('Add item clicked!')
            }}
          />
        </div>
      </section>
    </div>
  );
};

export default SafeComponentExample;