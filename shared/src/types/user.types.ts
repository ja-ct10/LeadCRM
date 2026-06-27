export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING';

export interface User {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}
