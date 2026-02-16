import { Response, NextFunction } from 'express';
import { User } from '../models/User';
import { ForbiddenError } from '../utils/errors';
import { AuthRequest } from './auth';

export async function adminMiddleware(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  if (!req.user?.userId) return next(new ForbiddenError('Forbidden'));
  const user = await User.findById(req.user.userId).select('isAdmin').lean();
  if (!user?.isAdmin) return next(new ForbiddenError('Admin access required'));
  next();
}
