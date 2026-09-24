// @leadcrm/shared — single source of truth for types, RBAC constants,
// API contracts, and validation schemas.
// Import from here in both frontend and backend — never duplicate.

export * from './types';
export * from './constants';
export * from './contracts';
export * from './validation';
export * from './contracts/auth.contract';
export * from './contracts/environment.contract';
export * from './constants/onboarding';
export * from './validation/auth.schema';
export * from './contracts/profile.contract';
export * from './contracts/record-sort';
export * from './contracts/lead-column-migration';

export * from './validation/administration-user.schema';
export * from './validation/deal-import.schema';
