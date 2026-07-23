import { User } from '@/store/types';

export interface UserDTO {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDTO {
  firstName: string;
  lastName: string;
  email: string;
  role?: string;
}

export interface UpdateUserDTO {
  firstName?: string;
  lastName?: string;
  role?: string;
  status?: string;
}

export const userAdapter = {
  toModel: (dto: UserDTO): User => ({
    id: dto.id,
    firstName: dto.firstName,
    lastName: dto.lastName,
    email: dto.email,
    role: dto.role,
    status: (dto.status.toLowerCase() as 'active' | 'inactive' | 'pending'),
    tenantId: dto.tenantId,
    // Other fields in User model that might be missing can be handled here
  }),
  
  toModels: (dtos: UserDTO[]): User[] => dtos.map(userAdapter.toModel),
  
  toCreateDTO: (user: Partial<User>): CreateUserDTO => ({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    email: user.email || '',
    role: user.role,
  }),
  
  toUpdateDTO: (user: Partial<User>): UpdateUserDTO => ({
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
  }),
};
