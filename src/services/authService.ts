import { Amplify } from 'aws-amplify';
import { 
  signOut, 
  getCurrentUser, 
  fetchAuthSession, 
  signInWithRedirect,
  signIn,
  signUp,
  confirmSignUp,
  resetPassword,
  confirmResetPassword
} from 'aws-amplify/auth';

// Check if we're in development mode without Cognito configured
const isDevelopmentMode = () => {
  return !process.env.REACT_APP_USER_POOL_ID || 
         process.env.REACT_APP_USER_POOL_ID === '' ||
         process.env.REACT_APP_ENV === 'local';
};

// Configure Amplify with Cognito settings
const configureAmplify = () => {
  if (isDevelopmentMode()) {
    console.log('Running in development mode - using mock authentication');
    return;
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.REACT_APP_USER_POOL_ID || '',
        userPoolClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID || '',
        identityPoolId: process.env.REACT_APP_IDENTITY_POOL_ID || '',
        loginWith: {
          oauth: {
            domain: process.env.REACT_APP_COGNITO_DOMAIN || '',
            scopes: ['email', 'openid', 'profile'],
            redirectSignIn: [window.location.origin + '/auth/callback'],
            redirectSignOut: [window.location.origin],
            responseType: 'code',
            providers: ['Google', 'Facebook'],
          },
        },
      },
    },
  });
};

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface User {
  userId: string;
  email: string;
  name?: string;
  socialProviders: string[];
  lastLogin: string;
}

class AuthService {
  private apiUrl: string;

  constructor() {
    this.apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    configureAmplify();
  }

  // Initialize authentication on app start
  async initializeAuth(): Promise<{ user: User; tokens: AuthTokens } | null> {
    if (isDevelopmentMode()) {
      // Check for mock session in localStorage
      const mockSession = localStorage.getItem('mockAuthSession');
      if (mockSession) {
        try {
          const session = JSON.parse(mockSession);
          // Check if tokens are still valid (not expired)
          if (!this.isTokenExpired(session.tokens)) {
            return session;
          } else {
            // Clear expired session
            localStorage.removeItem('mockAuthSession');
          }
        } catch (error) {
          console.log('Invalid mock session found, clearing...');
          localStorage.removeItem('mockAuthSession');
        }
      }
      return null;
    }

    try {
      const session = await fetchAuthSession();
      if (session && session.tokens) {
        await getCurrentUser(); // Verify user is authenticated
        const tokens = this.extractTokensFromSession(session);
        
        // Call our backend to sync user data
        const user = await this.syncUserWithBackend(tokens.accessToken);
        
        return { user, tokens };
      }
      return null;
    } catch (error) {
      console.log('No authenticated user found');
      return null;
    }
  }

  // Social login with Google
  async loginWithGoogle(): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      await signInWithRedirect({ provider: { custom: 'Google' } });
      // The actual token handling will be done in the callback
      throw new Error('Redirect to Google OAuth');
    } catch (error) {
      throw new Error(`Google login failed: ${error}`);
    }
  }

  // Social login with Facebook
  async loginWithFacebook(): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      await signInWithRedirect({ provider: { custom: 'Facebook' } });
      // The actual token handling will be done in the callback
      throw new Error('Redirect to Facebook OAuth');
    } catch (error) {
      throw new Error(`Facebook login failed: ${error}`);
    }
  }

  // Social login with X (Twitter)
  async loginWithX(): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      await signInWithRedirect({ provider: { custom: 'Twitter' } });
      // The actual token handling will be done in the callback
      throw new Error('Redirect to X OAuth');
    } catch (error) {
      throw new Error(`X login failed: ${error}`);
    }
  }

  // Email/password login
  async loginWithEmail(email: string, password: string): Promise<{ user: User; tokens: AuthTokens }> {
    if (isDevelopmentMode()) {
      return this.mockEmailLogin(email, password);
    }

    try {
      const result = await signIn({
        username: email,
        password: password,
      });

      if (result.isSignedIn) {
        const session = await fetchAuthSession();
        const tokens = this.extractTokensFromSession(session);
        
        // Call our backend to sync user data
        const user = await this.syncUserWithBackend(tokens.accessToken);
        
        return { user, tokens };
      } else {
        throw new Error('Sign in not completed');
      }
    } catch (error: any) {
      if (error.name === 'UserNotConfirmedException') {
        throw new Error('Please verify your email address before signing in');
      } else if (error.name === 'NotAuthorizedException') {
        throw new Error('Invalid email or password');
      } else if (error.name === 'UserNotFoundException') {
        throw new Error('No account found with this email address');
      }
      throw new Error(`Email login failed: ${error.message || error}`);
    }
  }

  // Email registration
  async registerWithEmail(email: string, password: string): Promise<{ requiresConfirmation: boolean }> {
    if (isDevelopmentMode()) {
      return this.mockEmailRegister(email, password);
    }

    try {
      const result = await signUp({
        username: email,
        password: password,
        options: {
          userAttributes: {
            email: email,
          },
        },
      });

      return {
        requiresConfirmation: !result.isSignUpComplete,
      };
    } catch (error: any) {
      if (error.name === 'UsernameExistsException') {
        throw new Error('An account with this email already exists');
      } else if (error.name === 'InvalidPasswordException') {
        throw new Error('Password must be at least 8 characters with uppercase, lowercase, and numbers');
      } else if (error.name === 'InvalidParameterException') {
        throw new Error('Please enter a valid email address');
      }
      throw new Error(`Registration failed: ${error.message || error}`);
    }
  }

  // Confirm email verification
  async confirmEmail(email: string, confirmationCode: string): Promise<void> {
    if (isDevelopmentMode()) {
      return this.mockConfirmEmail(email, confirmationCode);
    }

    try {
      await confirmSignUp({
        username: email,
        confirmationCode: confirmationCode,
      });
    } catch (error: any) {
      if (error.name === 'CodeMismatchException') {
        throw new Error('Invalid verification code');
      } else if (error.name === 'ExpiredCodeException') {
        throw new Error('Verification code has expired. Please request a new one');
      }
      throw new Error(`Email confirmation failed: ${error.message || error}`);
    }
  }

  // Request password reset
  async requestPasswordReset(email: string): Promise<void> {
    if (isDevelopmentMode()) {
      return this.mockRequestPasswordReset(email);
    }

    try {
      await resetPassword({
        username: email,
      });
    } catch (error: any) {
      if (error.name === 'UserNotFoundException') {
        throw new Error('No account found with this email address');
      }
      throw new Error(`Password reset request failed: ${error.message || error}`);
    }
  }

  // Confirm password reset
  async confirmPasswordReset(email: string, confirmationCode: string, newPassword: string): Promise<void> {
    if (isDevelopmentMode()) {
      return this.mockConfirmPasswordReset(email, confirmationCode, newPassword);
    }

    try {
      await confirmResetPassword({
        username: email,
        confirmationCode: confirmationCode,
        newPassword: newPassword,
      });
    } catch (error: any) {
      if (error.name === 'CodeMismatchException') {
        throw new Error('Invalid reset code');
      } else if (error.name === 'ExpiredCodeException') {
        throw new Error('Reset code has expired. Please request a new one');
      } else if (error.name === 'InvalidPasswordException') {
        throw new Error('Password must be at least 8 characters with uppercase, lowercase, and numbers');
      }
      throw new Error(`Password reset failed: ${error.message || error}`);
    }
  }

  // Handle OAuth callback
  async handleOAuthCallback(): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      const session = await fetchAuthSession();
      const tokens = this.extractTokensFromSession(session);
      
      // Call our backend to sync user data
      const user = await this.syncUserWithBackend(tokens.accessToken);
      
      return { user, tokens };
    } catch (error) {
      throw new Error(`OAuth callback failed: ${error}`);
    }
  }

  // Refresh access token
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const response = await fetch(`${this.apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken,
          clientId: process.env.REACT_APP_USER_POOL_CLIENT_ID,
        }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      return {
        accessToken: data.accessToken,
        idToken: data.idToken,
        refreshToken: refreshToken, // Refresh token doesn't change
        expiresIn: data.expiresIn,
        tokenType: 'Bearer',
      };
    } catch (error) {
      throw new Error(`Token refresh failed: ${error}`);
    }
  }

  // Logout user
  async logout(accessToken: string): Promise<void> {
    if (isDevelopmentMode()) {
      // Clear mock session
      localStorage.removeItem('mockAuthSession');
      return;
    }

    try {
      // Call our backend logout endpoint
      await fetch(`${this.apiUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessToken }),
      });

      // Sign out from Cognito
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
      // Even if backend call fails, still sign out locally
      await signOut();
    }
  }

  // Extract tokens from Cognito session
  private extractTokensFromSession(session: any): AuthTokens {
    const accessToken = session.tokens?.accessToken?.toString() || '';
    const idToken = session.tokens?.idToken?.toString() || '';
    const refreshToken = session.tokens?.refreshToken?.toString() || '';
    const expiresIn = session.tokens?.accessToken?.payload?.exp 
      ? session.tokens.accessToken.payload.exp - Math.floor(Date.now() / 1000)
      : 3600; // Default to 1 hour

    return {
      accessToken,
      idToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
    };
  }

  // Sync user data with our backend
  private async syncUserWithBackend(accessToken: string): Promise<User> {
    const response = await fetch(`${this.apiUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessToken,
        userPoolId: process.env.REACT_APP_USER_POOL_ID,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to sync user with backend');
    }

    const data = await response.json();
    return data.user;
  }

  // Check if token is expired
  isTokenExpired(tokens: AuthTokens): boolean {
    const now = Math.floor(Date.now() / 1000);
    const expirationTime = now + tokens.expiresIn;
    return expirationTime <= now + 300; // Refresh 5 minutes before expiry
  }

  // Mock authentication methods for development mode
  private async mockEmailLogin(email: string, password: string): Promise<{ user: User; tokens: AuthTokens }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get stored users from localStorage
    const storedUsers = JSON.parse(localStorage.getItem('mockUsers') || '{}');
    
    // Check if user exists and password matches
    const user = storedUsers[email];
    if (!user) {
      throw new Error('No account found with this email address');
    }

    if (user.password !== password) {
      throw new Error('Invalid email or password');
    }

    if (!user.emailConfirmed) {
      throw new Error('Please verify your email address before signing in');
    }

    // Generate mock tokens
    const tokens: AuthTokens = {
      accessToken: `mock-access-token-${Date.now()}`,
      idToken: `mock-id-token-${Date.now()}`,
      refreshToken: `mock-refresh-token-${Date.now()}`,
      expiresIn: 3600,
      tokenType: 'Bearer',
    };

    // Create user object
    const userData: User = {
      userId: user.userId,
      email: user.email,
      name: user.name,
      socialProviders: [],
      lastLogin: new Date().toISOString(),
    };

    // Store current session
    localStorage.setItem('mockAuthSession', JSON.stringify({ user: userData, tokens }));

    return { user: userData, tokens };
  }

  private async mockEmailRegister(email: string, password: string): Promise<{ requiresConfirmation: boolean }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Please enter a valid email address');
    }

    // Validate password strength
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters with uppercase, lowercase, and numbers');
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      throw new Error('Password must be at least 8 characters with uppercase, lowercase, and numbers');
    }

    // Get stored users from localStorage
    const storedUsers = JSON.parse(localStorage.getItem('mockUsers') || '{}');
    
    // Check if user already exists
    if (storedUsers[email]) {
      throw new Error('An account with this email already exists');
    }

    // Create new user
    const newUser = {
      userId: `mock-user-${Date.now()}`,
      email,
      password,
      name: email.split('@')[0],
      emailConfirmed: false,
      confirmationCode: Math.floor(100000 + Math.random() * 900000).toString(),
      createdAt: new Date().toISOString(),
    };

    // Store user
    storedUsers[email] = newUser;
    localStorage.setItem('mockUsers', JSON.stringify(storedUsers));

    // In development, we'll auto-confirm for easier testing
    console.log(`Mock confirmation code for ${email}: ${newUser.confirmationCode}`);

    return { requiresConfirmation: true };
  }

  private async mockConfirmEmail(email: string, confirmationCode: string): Promise<void> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get stored users from localStorage
    const storedUsers = JSON.parse(localStorage.getItem('mockUsers') || '{}');
    
    const user = storedUsers[email];
    if (!user) {
      throw new Error('No account found with this email address');
    }

    if (user.confirmationCode !== confirmationCode) {
      throw new Error('Invalid verification code');
    }

    // Confirm the user
    user.emailConfirmed = true;
    delete user.confirmationCode;
    
    storedUsers[email] = user;
    localStorage.setItem('mockUsers', JSON.stringify(storedUsers));
  }

  private async mockRequestPasswordReset(email: string): Promise<void> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get stored users from localStorage
    const storedUsers = JSON.parse(localStorage.getItem('mockUsers') || '{}');
    
    const user = storedUsers[email];
    if (!user) {
      throw new Error('No account found with this email address');
    }

    // Generate reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetCode = resetCode;
    
    storedUsers[email] = user;
    localStorage.setItem('mockUsers', JSON.stringify(storedUsers));

    console.log(`Mock password reset code for ${email}: ${resetCode}`);
  }

  private async mockConfirmPasswordReset(email: string, confirmationCode: string, newPassword: string): Promise<void> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Validate password strength
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters with uppercase, lowercase, and numbers');
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      throw new Error('Password must be at least 8 characters with uppercase, lowercase, and numbers');
    }

    // Get stored users from localStorage
    const storedUsers = JSON.parse(localStorage.getItem('mockUsers') || '{}');
    
    const user = storedUsers[email];
    if (!user) {
      throw new Error('No account found with this email address');
    }

    if (user.resetCode !== confirmationCode) {
      throw new Error('Invalid reset code');
    }

    // Update password
    user.password = newPassword;
    delete user.resetCode;
    
    storedUsers[email] = user;
    localStorage.setItem('mockUsers', JSON.stringify(storedUsers));
  }
}

export const authService = new AuthService();