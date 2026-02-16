import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { verify } from 'otplib';
import { IUser } from '../models/User';
import { User } from '../models/User';
import { Config } from '../models/Config';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import { config } from '../config';

const SALT_ROUNDS = 12;

export interface TokenPayload {
  userId: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function register(
  email: string,
  password: string,
  encryptedMasterKey: string
): Promise<{ user: IUser; tokens: AuthTokens }> {
  const maintenance = await Config.findOne({ key: 'maintenanceMode' });
  if (maintenance?.value === 'true') {
    throw new BadRequestError('System is under maintenance. Registration is temporarily disabled.');
  }
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new BadRequestError('Email already registered');
  }

  if (!encryptedMasterKey || typeof encryptedMasterKey !== 'string') {
    throw new BadRequestError('Encrypted master key required');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({
    email: email.toLowerCase(),
    passwordHash,
    encryptedMasterKey,
  });

  const tokens = generateTokens(user);
  return { user, tokens };
}

export async function login(email: string, password: string): Promise<{ user: IUser; tokens: AuthTokens }> {
  const result = await loginWithTotp(email, password, undefined);
  if ('requiresTotp' in result && result.requiresTotp) throw new UnauthorizedError('TOTP code required');
  return { user: result.user!, tokens: result.tokens! };
}

export async function loginWithTotp(
  email: string,
  password: string,
  totpCode?: string
): Promise<
  | { user: IUser; tokens: AuthTokens }
  | { requiresTotp: true; user?: never; tokens?: never }
> {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }
  if (user.disabledAt) {
    throw new UnauthorizedError('Account is disabled');
  }
  const maintenance = await Config.findOne({ key: 'maintenanceMode' });
  if (maintenance?.value === 'true' && !user.isAdmin) {
    throw new UnauthorizedError('System is under maintenance. Please try again later.');
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (user.totpEnabled) {
    if (!totpCode || typeof totpCode !== 'string' || !totpCode.trim()) {
      return { requiresTotp: true };
    }
    if (!user.totpSecret) {
      throw new UnauthorizedError('2FA misconfigured');
    }
    const valid = verify({ token: totpCode.trim(), secret: user.totpSecret });
    if (!valid) {
      throw new UnauthorizedError('Invalid TOTP code');
    }
  }

  const tokens = generateTokens(user);
  return { user, tokens };
}

export function generateTokens(user: IUser): AuthTokens {
  const payload: TokenPayload = { userId: user._id.toString(), email: user.email };
  const accessToken = jwt.sign(payload, config.jwtSecret, {
    expiresIn: 15 * 60, // 15 minutes
  });
  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },
    config.jwtRefreshSecret,
    { expiresIn: 7 * 24 * 60 * 60 } // 7 days
  );

  const decoded = jwt.decode(accessToken) as { exp?: number } | null;
  const expiresIn = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 900;

  return { accessToken, refreshToken, expiresIn };
}

export async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  let decoded: TokenPayload & { type?: string };
  try {
    decoded = jwt.verify(refreshToken, config.jwtRefreshSecret) as TokenPayload & { type?: string };
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
  if (decoded.type !== 'refresh') {
    throw new UnauthorizedError('Invalid refresh token');
  }

  const user = await User.findById(decoded.userId);
  if (!user) {
    throw new UnauthorizedError('User not found');
  }
  if (user.disabledAt) {
    throw new UnauthorizedError('Account is disabled');
  }

  return generateTokens(user);
}
