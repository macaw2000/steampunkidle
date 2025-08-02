import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { loginStart, loginSuccess, loginFailure } from '../../store/slices/authSlice';
import { authService } from '../../services/authService';
import './LoginComponent.css';

type AuthMode = 'login' | 'register' | 'confirm' | 'forgot' | 'reset';

const LoginComponent: React.FC = () => {
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state: RootState) => state.auth);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSocialLogin = async (provider: 'google' | 'facebook' | 'x') => {
    dispatch(loginStart());
    setSelectedProvider(provider);

    try {
      let result;
      switch (provider) {
        case 'google':
          result = await authService.loginWithGoogle();
          break;
        case 'facebook':
          result = await authService.loginWithFacebook();
          break;
        case 'x':
          result = await authService.loginWithX();
          break;
        default:
          throw new Error('Invalid provider');
      }

      dispatch(loginSuccess(result));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      
      // Don't show error for OAuth redirects
      if (!errorMessage.includes('Redirect to')) {
        dispatch(loginFailure(errorMessage));
      }
    } finally {
      setSelectedProvider(null);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    dispatch(loginStart());
    try {
      const result = await authService.loginWithEmail(email, password);
      dispatch(loginSuccess(result));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      dispatch(loginFailure(errorMessage));
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !confirmPassword) return;
    
    if (password !== confirmPassword) {
      dispatch(loginFailure('Passwords do not match'));
      return;
    }

    dispatch(loginStart());
    try {
      const result = await authService.registerWithEmail(email, password);
      if (result.requiresConfirmation) {
        setAuthMode('confirm');
        dispatch(loginFailure('Please check your email for a verification code'));
      } else {
        // Auto-login after successful registration
        const loginResult = await authService.loginWithEmail(email, password);
        dispatch(loginSuccess(loginResult));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      dispatch(loginFailure(errorMessage));
    }
  };

  const handleEmailConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !confirmationCode) return;

    dispatch(loginStart());
    try {
      await authService.confirmEmail(email, confirmationCode);
      // Auto-login after confirmation
      const result = await authService.loginWithEmail(email, password);
      dispatch(loginSuccess(result));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Email confirmation failed';
      dispatch(loginFailure(errorMessage));
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    dispatch(loginStart());
    try {
      await authService.requestPasswordReset(email);
      setAuthMode('reset');
      dispatch(loginFailure('Please check your email for a password reset code'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Password reset request failed';
      dispatch(loginFailure(errorMessage));
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !confirmationCode || !password || !confirmPassword) return;
    
    if (password !== confirmPassword) {
      dispatch(loginFailure('Passwords do not match'));
      return;
    }

    dispatch(loginStart());
    try {
      await authService.confirmPasswordReset(email, confirmationCode, password);
      setAuthMode('login');
      setConfirmationCode('');
      setPassword('');
      setConfirmPassword('');
      dispatch(loginFailure('Password reset successful. Please log in with your new password.'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Password reset failed';
      dispatch(loginFailure(errorMessage));
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setConfirmationCode('');
    dispatch(loginFailure(''));
  };

  const switchMode = (mode: AuthMode) => {
    setAuthMode(mode);
    resetForm();
  };

  const handleBypassLogin = () => {
    // Create a mock user session for development
    const mockUser = {
      userId: 'dev-user-123',
      email: 'dev@example.com',
      name: 'Dev User',
      socialProviders: [],
      lastLogin: new Date().toISOString(),
    };

    const mockTokens = {
      accessToken: `dev-access-token-${Date.now()}`,
      idToken: `dev-id-token-${Date.now()}`,
      refreshToken: `dev-refresh-token-${Date.now()}`,
      expiresIn: 604800, // 7 days
      tokenType: 'Bearer',
    };

    // Store the session in both formats for compatibility
    localStorage.setItem('mockAuthSession', JSON.stringify({ user: mockUser, tokens: mockTokens }));
    
    // Also store in persistent format
    const sessionData = {
      tokens: mockTokens,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };
    localStorage.setItem('steampunk_idle_session', JSON.stringify(sessionData));
    localStorage.setItem('steampunk_idle_user', JSON.stringify(mockUser));
    
    // Dispatch login success
    dispatch(loginSuccess({ user: mockUser, tokens: mockTokens }));
  };

  const renderEmailForm = () => {
    switch (authMode) {
      case 'login':
        return (
          <form onSubmit={handleEmailLogin} className="email-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>
            <button type="submit" className="email-submit-btn" disabled={loading || !email || !password}>
              {loading ? 'Signing In...' : 'Sign In with Email'}
            </button>
            <div className="form-links">
              <button type="button" onClick={() => switchMode('register')} className="link-btn">
                Don't have an account? Register
              </button>
              <button type="button" onClick={() => switchMode('forgot')} className="link-btn">
                Forgot your password?
              </button>
            </div>
          </form>
        );

      case 'register':
        return (
          <form onSubmit={handleEmailRegister} className="email-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters with uppercase, lowercase, and numbers"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="email-submit-btn" disabled={loading || !email || !password || !confirmPassword}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
            <div className="form-links">
              <button type="button" onClick={() => switchMode('login')} className="link-btn">
                Already have an account? Sign In
              </button>
            </div>
          </form>
        );

      case 'confirm':
        return (
          <form onSubmit={handleEmailConfirmation} className="email-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirmationCode">Verification Code</label>
              <input
                type="text"
                id="confirmationCode"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                placeholder="Enter the code from your email"
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="email-submit-btn" disabled={loading || !email || !confirmationCode}>
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>
            <div className="form-links">
              <button type="button" onClick={() => switchMode('login')} className="link-btn">
                Back to Sign In
              </button>
            </div>
          </form>
        );

      case 'forgot':
        return (
          <form onSubmit={handleForgotPassword} className="email-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="email-submit-btn" disabled={loading || !email}>
              {loading ? 'Sending Reset Code...' : 'Send Reset Code'}
            </button>
            <div className="form-links">
              <button type="button" onClick={() => switchMode('login')} className="link-btn">
                Back to Sign In
              </button>
            </div>
          </form>
        );

      case 'reset':
        return (
          <form onSubmit={handlePasswordReset} className="email-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirmationCode">Reset Code</label>
              <input
                type="text"
                id="confirmationCode"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                placeholder="Enter the code from your email"
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">New Password</label>
              <div className="password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters with uppercase, lowercase, and numbers"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="email-submit-btn" disabled={loading || !email || !confirmationCode || !password || !confirmPassword}>
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </button>
            <div className="form-links">
              <button type="button" onClick={() => switchMode('login')} className="link-btn">
                Back to Sign In
              </button>
            </div>
          </form>
        );

      default:
        return null;
    }
  };

  return (
    <div className="login-component">
      <div className="login-container">
        <div className="login-header">
          <h2>Welcome to Steampunk Idle Game</h2>
          <p>Choose your preferred login method to start your adventure</p>
        </div>

        {error && (
          <div className={`error-message ${error.includes('successful') || error.includes('check your email') ? 'success-message' : ''}`}>
            <span className="error-icon">{error.includes('successful') || error.includes('check your email') ? '✅' : '⚠️'}</span>
            {error}
          </div>
        )}

        {/* Email Authentication Form */}
        <div className="email-auth-section">
          <div className="auth-mode-header">
            <h3>
              {authMode === 'login' && 'Sign In'}
              {authMode === 'register' && 'Create Account'}
              {authMode === 'confirm' && 'Verify Email'}
              {authMode === 'forgot' && 'Reset Password'}
              {authMode === 'reset' && 'Set New Password'}
            </h3>
          </div>
          {renderEmailForm()}
        </div>

        {/* Divider */}
        <div className="auth-divider">
          <span>or continue with</span>
        </div>

        {/* Social Login Buttons */}
        <div className="social-login-buttons">
          <button
            className={`social-login-btn google-btn ${selectedProvider === 'google' ? 'loading' : ''}`}
            onClick={() => handleSocialLogin('google')}
            disabled={loading}
          >
            <div className="btn-content">
              <span className="social-icon">🔍</span>
              <span className="btn-text">
                {selectedProvider === 'google' && loading ? 'Connecting...' : 'Continue with Google'}
              </span>
            </div>
          </button>

          <button
            className={`social-login-btn facebook-btn ${selectedProvider === 'facebook' ? 'loading' : ''}`}
            onClick={() => handleSocialLogin('facebook')}
            disabled={loading}
          >
            <div className="btn-content">
              <span className="social-icon">📘</span>
              <span className="btn-text">
                {selectedProvider === 'facebook' && loading ? 'Connecting...' : 'Continue with Facebook'}
              </span>
            </div>
          </button>

          <button
            className={`social-login-btn x-btn ${selectedProvider === 'x' ? 'loading' : ''}`}
            onClick={() => handleSocialLogin('x')}
            disabled={loading}
          >
            <div className="btn-content">
              <span className="social-icon">🐦</span>
              <span className="btn-text">
                {selectedProvider === 'x' && loading ? 'Connecting...' : 'Continue with X'}
              </span>
            </div>
          </button>
        </div>

        {/* Development Bypass Button */}
        <div className="dev-bypass-section">
          <button
            className="bypass-btn"
            onClick={handleBypassLogin}
            disabled={loading}
          >
            🚀 Skip Login (Dev Mode)
          </button>
        </div>

        <div className="login-footer">
          <p className="steampunk-flavor">
            "In the age of steam and gears, every adventurer needs proper credentials!"
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginComponent;