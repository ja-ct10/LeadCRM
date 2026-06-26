import { User } from '../types/user.types';

export interface CreateUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  role?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface UserListResponse {
  data: Omit<User, 'passwordHash'>[];
  meta: { total: number; page: number; limit: number; hasMore: boolean };
}

export interface AuthResponse {
  token: string;
  user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'role' | 'tenantId'>;
}
