/**
 * User-related type definitions for the Steampunk Idle Game
 */

export interface SocialProvider {
  provider: 'google' | 'facebook' | 'x';
  providerId: string;
  email?: string;
}

export interface User {
  userId: string;
  email: string;
  socialProviders: SocialProvider[];
  createdAt: Date;
  lastLogin: Date;
}

export interface CreateUserRequest {
  email: string;
  socialProvider: SocialProvider;
}

export interface UpdateUserRequest {
  userId: string;
  lastLogin?: Date;
  socialProviders?: SocialProvider[];
}