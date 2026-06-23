import jwt from 'jsonwebtoken';
import { appConfig } from '../../config/app.config';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, appConfig.jwtSecret, {
    expiresIn: appConfig.jwtExpiresIn,
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, appConfig.jwtSecret) as JwtPayload;
}
