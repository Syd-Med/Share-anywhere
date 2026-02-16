import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UnauthorizedError } from '../utils/errors';

export interface TokenPayload {
  userId: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

export function authMiddleware(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('No token provided'));
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as TokenPayload;
    req.user = decoded;
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}
