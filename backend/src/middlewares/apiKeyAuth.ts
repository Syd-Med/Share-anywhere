import { Request, Response, NextFunction } from 'express';
import { APIKey, hashKey } from '../models/APIKey';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';

export interface APIKeyRequest extends Request {
  apiKey?: { userId: string; scopes: string[]; keyId: string };
}

export async function apiKeyMiddleware(req: APIKeyRequest, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('API key required. Use Authorization: Bearer <api_key>'));
  }

  const key = authHeader.slice(7);
  if (!key.startsWith('sa_')) {
    return next(new UnauthorizedError('Invalid API key format'));
  }

  const keyHash = hashKey(key);
  const keyPrefix = key.slice(0, 12);
  const apiKey = await APIKey.findOne({ keyHash }).lean();
  if (!apiKey) {
    return next(new UnauthorizedError('Invalid API key'));
  }

  req.apiKey = {
    userId: (apiKey.userId as { toString: () => string }).toString(),
    scopes: apiKey.scopes,
    keyId: apiKey._id.toString(),
  };

  await APIKey.updateOne({ _id: apiKey._id }, { lastUsedAt: new Date() });

  next();
}

export function requireScope(scope: string) {
  return (req: APIKeyRequest, _res: Response, next: NextFunction): void => {
    if (!req.apiKey?.scopes.includes(scope)) {
      return next(new ForbiddenError(`Scope ${scope} required`));
    }
    next();
  };
}
