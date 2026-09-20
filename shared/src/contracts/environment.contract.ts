import { z } from 'zod';

export const CrmEnvironmentSchema = z.enum(['SANDBOX', 'PRODUCTION']);
export type CrmEnvironment = z.infer<typeof CrmEnvironmentSchema>;
export const ChangeEnvironmentSchema = z.object({ environment: CrmEnvironmentSchema }).strict();
export interface EnvironmentResponse {
  success: boolean;
  data: { environment: CrmEnvironment };
}
