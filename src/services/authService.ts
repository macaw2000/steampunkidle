/**
 * Authentication Service - AWS Cognito Only
 * Simplified authentication service that only uses AWS Cognito
 */

import { Amplify } from 'aws-amplify';
import { signIn, signUp, confirmSignUp, resetPassword, confirmResetPassword, signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import { User, AuthTokens } from '../types/auth';
import { EnvironmentService } from './environmentService';

// Configure Amplify with Cognito settings
const configureAmplify = () => {
  console.log('Configuring AWS Amplify for Cognito authentication');

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.REACT_APP_USER_POOL_ID || '',
        userPoolClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID || '',
        identityPoolId: process.env.REACT_APP_IDENTITY_POOL_ID || '',
        loginWith: {
          email: true,
        },
      },
    },
  });
};

// Initialize Amplify configuration
configureAmplify();

export interface AuthError extends Error {
  code?: string;
  name: string;
}

/**
 * Authentication Service
 * Handles user authentication using AWS Cognito
 */
export class AuthService {
  private static instance: AuthService;
  private currentUser: User | null = null;
  private authTokens: AuthTokens | null = null;

  constructor() {
    // Singleton pattern
    if (AuthService.instance) {
      return AuthService.instance;
    }
    AuthService.instance = this;
  }

  /**
   * Initialize authentication and check for existing session
   */
  async initializeAuth(): Promise<{ user: User; tokens: AuthTokens } | null> {
    try {
      console.log('AuthService: Initializing AWS Cognito authentication');
      
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();

      if (currentUser && session.tokens) {
        const user: User = {
          userId: currentUser.userId,
          email: currentUser.signInDetails?.loginId || '',
          name: currentUser.username,
          socialProviders: [],
          lastLogin: new Date().toISOString(),
        };

        const tokens: AuthTokens = {
          accessToken: session.tokens.accessToken?.toString() || '',
          idToken: session.tokens.idToken?.toString() || '',
          refreshToken: 'refresh-token-placeholder', // AWS Amplify handles refresh automatically
          expiresIn: 3600, // Default to 1 hour
          tokenType: 'Bearer',
        };

        this.currentUser = user;
        this.authTokens = tokens;

        console.log('AuthService: Successfully restored AWS Cognito session');
        return { user, tokens };
      }

      console.log('AuthService: No existing AWS Cognito session found');
      return null;
    } catch (error: any) {
      console.log('AuthService: No existing session or session expired');
      return null;
    }
  }

  /**
   * Login with email and password using AWS Cognito
   */
  async loginWithEmail(email: string, password: string): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      console.log('AuthService: Attempting AWS Cognito login for:', email);
      
      const signInResult = await signIn({
        username: email,
        password: password,
      });

      if (signInResult.isSignedIn) {
        const currentUser = await getCurrentUser();
        const session = await fetchAuthSession();

        if (!session.tokens) {
          throw new Error('Failed to retrieve authentication tokens');
        }

        const user: User = {
          userId: currentUser.userId,
          email: email,
          name: currentUser.username,
          socialProviders: [],
          lastLogin: new Date().toISOString(),
        };

        const tokens: AuthTokens = {
          accessToken: session.tokens.accessToken?.toString() || '',
          idToken: session.tokens.idToken?.toString() || '',
          refreshToken: 'refresh-token-placeholder', // AWS Amplify handles refresh automatically
          expiresIn: 3600, // Default to 1 hour
          tokenType: 'Bearer',
        };

        this.currentUser = user;
        this.authTokens = tokens;

        console.log('AuthService: AWS Cognito login successful');
        return { user, tokens };
      } else {
        throw new Error('Sign in was not completed');
      }
    } catch (error: any) {
      console.error('AuthService: AWS Cognito login failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Register with email and password using AWS Cognito
   */
  async registerWithEmail(email: string, password: string): Promise<{ requiresConfirmation: boolean }> {
    try {
      console.log('AuthService: Attempting AWS Cognito registration for:', email);
      
      const signUpResult = await signUp({
        username: email,
        password: password,
        options: {
          userAttributes: {
            email: email,
          },
        },
      });

      console.log('AuthService: AWS Cognito registration initiated');
      return { requiresConfirmation: !signUpResult.isSignUpComplete };
    } catch (error: any) {
      console.error('AuthService: AWS Cognito registration failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Confirm email with verification code using AWS Cognito
   */
  async confirmEmail(email: string, confirmationCode: string): Promise<void> {
    try {
      console.log('AuthService: Confirming AWS Cognito email for:', email);
      
      await confirmSignUp({
        username: email,
        confirmationCode: confirmationCode,
      });

      console.log('AuthService: AWS Cognito email confirmation successful');
    } catch (error: any) {
      console.error('AuthService: AWS Cognito email confirmation failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Request password reset using AWS Cognito
   */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      console.log('AuthService: Requesting AWS Cognito password reset for:', email);
      
      await resetPassword({
        username: email,
      });

      console.log('AuthService: AWS Cognito password reset request sent');
    } catch (error: any) {
      console.error('AuthService: AWS Cognito password reset request failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Confirm password reset with code and new password using AWS Cognito
   */
  async confirmPasswordReset(email: string, confirmationCode: string, newPassword: string): Promise<void> {
    try {
      console.log('AuthService: Confirming AWS Cognito password reset for:', email);
      
      await confirmResetPassword({
        username: email,
        confirmationCode: confirmationCode,
        newPassword: newPassword,
      });

      console.log('AuthService: AWS Cognito password reset successful');
    } catch (error: any) {
      console.error('AuthService: AWS Cognito password reset confirmation failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Get current auth tokens
   */
  getAuthTokens(): AuthTokens | null {
    return this.authTokens;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null && this.authTokens !== null;
  }

  /**
   * Logout user using AWS Cognito
   */
  async logout(accessToken: string): Promise<void> {
    try {
      console.log('AuthService: Logging out from AWS Cognito');
      
      await signOut();
      
      this.currentUser = null;
      this.authTokens = null;

      console.log('AuthService: AWS Cognito logout successful');
    } catch (error: any) {
      console.error('AuthService: AWS Cognito logout failed:', error);
      // Clear local state even if logout fails
      this.currentUser = null;
      this.authTokens = null;
      throw this.handleAuthError(error);
    }
  }

  /**
   * Handle OAuth callback (simplified for AWS Cognito)
   */
  async handleOAuthCallback(): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      console.log('AuthService: Handling OAuth callback');
      
      // For AWS Cognito, we can check if there's a current session
      const result = await this.initializeAuth();
      
      if (result) {
        console.log('AuthService: OAuth callback successful');
        return result;
      } else {
        throw new Error('No valid session found after OAuth callback');
      }
    } catch (error: any) {
      console.error('AuthService: OAuth callback failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(tokens: AuthTokens): boolean {
    try {
      // For AWS Cognito, we can decode the JWT token to check expiration
      const payload = JSON.parse(atob(tokens.accessToken.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp < currentTime;
    } catch (error) {
      console.error('AuthService: Error checking token expiration:', error);
      return true; // Assume expired if we can't parse
    }
  }

  /**
   * Refresh authentication tokens
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      console.log('AuthService: Refreshing AWS Cognito tokens');
      
      const session = await fetchAuthSession({ forceRefresh: true });
      
      if (!session.tokens) {
        throw new Error('Failed to refresh tokens');
      }

      const tokens: AuthTokens = {
        accessToken: session.tokens.accessToken?.toString() || '',
        idToken: session.tokens.idToken?.toString() || '',
        refreshToken: 'refresh-token-placeholder', // AWS Amplify handles refresh automatically
        expiresIn: 3600, // Default to 1 hour
        tokenType: 'Bearer',
      };

      this.authTokens = tokens;
      console.log('AuthService: AWS Cognito token refresh successful');
      return tokens;
    } catch (error: any) {
      console.error('AuthService: AWS Cognito token refresh failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Login with Google (AWS Cognito Social Provider)
   */
  async loginWithGoogle(): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      console.log('AuthService: Initiating Google login via AWS Cognito');
      
      // For AWS Cognito social providers, this would typically redirect to the provider
      // For now, throw an error indicating this needs to be configured
      throw new Error('Google login requires AWS Cognito social provider configuration');
    } catch (error: any) {
      console.error('AuthService: Google login failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Login with Facebook (AWS Cognito Social Provider)
   */
  async loginWithFacebook(): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      console.log('AuthService: Initiating Facebook login via AWS Cognito');
      
      // For AWS Cognito social providers, this would typically redirect to the provider
      // For now, throw an error indicating this needs to be configured
      throw new Error('Facebook login requires AWS Cognito social provider configuration');
    } catch (error: any) {
      console.error('AuthService: Facebook login failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Login with X/Twitter (AWS Cognito Social Provider)
   */
  async loginWithX(): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      console.log('AuthService: Initiating X/Twitter login via AWS Cognito');
      
      // For AWS Cognito social providers, this would typically redirect to the provider
      // For now, throw an error indicating this needs to be configured
      throw new Error('X/Twitter login requires AWS Cognito social provider configuration');
    } catch (error: any) {
      console.error('AuthService: X/Twitter login failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Handle authentication errors
   */
  private handleAuthError(error: any): AuthError {
    const authError: AuthError = new Error(error.message || 'Authentication failed');
    authError.name = error.name || 'AuthError';
    authError.code = error.code;
    return authError;
  }

  /**
   * Get authentication status
   */
  getAuthStatus(): {
    isAuthenticated: boolean;
    user: User | null;
    hasValidTokens: boolean;
  } {
    return {
      isAuthenticated: this.isAuthenticated(),
      user: this.currentUser,
      hasValidTokens: this.authTokens !== null,
    };
  }
}

// Export singleton instance
export const authService = new AuthService();