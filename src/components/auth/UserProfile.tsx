import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { logout } from '../../store/slices/authSlice';
import { authService } from '../../services/authService';
import './UserProfile.css';

const UserProfile: React.FC = () => {
  const dispatch = useDispatch();
  const { user, tokens } = useSelector((state: RootState) => state.auth);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleLogout = async () => {
    if (!tokens) return;
    
    setIsLoggingOut(true);
    try {
      await authService.logout(tokens.accessToken);
      dispatch(logout());
    } catch (error) {
      console.error('Logout error:', error);
      // Still logout locally even if server call fails
      dispatch(logout());
    } finally {
      setIsLoggingOut(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getSocialProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'google':
        return '🔍';
      case 'facebook':
        return '📘';
      case 'x':
      case 'twitter':
        return '🐦';
      case 'cognito':
        return '🔐';
      default:
        return '🔗';
    }
  };

  if (!user) return null;

  return (
    <div className="user-profile">
      <div className="profile-header">
        <div className="user-avatar">
          <span className="avatar-icon">⚙️</span>
        </div>
        <div className="user-info">
          <h3 className="user-name">{user.name || user.email}</h3>
          <p className="user-email">{user.email}</p>
        </div>
        <button
          className="profile-toggle"
          onClick={() => setShowDetails(!showDetails)}
          title={showDetails ? 'Hide details' : 'Show details'}
        >
          {showDetails ? '▲' : '▼'}
        </button>
      </div>

      {showDetails && (
        <div className="profile-details">
          <div className="detail-section">
            <h4>Account Information</h4>
            <div className="detail-item">
              <span className="detail-label">User ID:</span>
              <span className="detail-value">{user.userId}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Last Login:</span>
              <span className="detail-value">{formatDate(user.lastLogin)}</span>
            </div>
          </div>

          <div className="detail-section">
            <h4>Connected Accounts</h4>
            <div className="social-providers">
              {user.socialProviders.map((provider, index) => (
                <div key={index} className="provider-item">
                  <span className="provider-icon">
                    {getSocialProviderIcon(provider)}
                  </span>
                  <span className="provider-name">
                    {provider.charAt(0).toUpperCase() + provider.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="profile-actions">
            <button
              className="logout-btn"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <>
                  <span className="loading-spinner">⚙️</span>
                  Logging out...
                </>
              ) : (
                <>
                  <span className="logout-icon">🚪</span>
                  Logout
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfile;