/**
 * Authentication Types
 * Type definitions for authentication-related data structures
 */

export interface User {
  userId: string;
  email: string;
  name?: string;
  socialProviders: string[];
  lastLogin: string;
}

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username?: string;
}

export interface ConfirmEmailRequest {
  email: string;
  confirmationCode: string;
}

export interface ResetPasswordRequest {
  email: string;
}

export interface ConfirmResetPasswordRequest {
  email: string;
  confirmationCode: string;
  newPassword: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  tokens: AuthTokens | null;
  loading: boolean;
  error: string | null;
}

export interface AuthError extends Error {
  code?: string;
  name: string;
}

export type SocialProvider = 'google' | 'facebook' | 'x';

export interface SocialLoginResult {
  user: User;
  tokens: AuthTokens;
  isNewUser?: boolean;
}