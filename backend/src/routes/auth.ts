import { Router } from 'express';
import { generateSecret, generateURI, verify } from 'otplib';
import * as QRCode from 'qrcode';
import * as authService from '../services/authService';
import { authMiddleware, AuthRequest } from '../middlewares/auth';
import { User } from '../models/User';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, encryptedMasterKey } = req.body;
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      throw new BadRequestError('Email and password required');
    }
    if (password.length < 8) {
      throw new BadRequestError('Password must be at least 8 characters');
    }

    const { user, tokens } = await authService.register(email, password, encryptedMasterKey);
    res.status(201).json({
      user: { id: user._id, email: user.email },
      encryptedMasterKey: user.encryptedMasterKey,
      ...tokens,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password, totpCode } = req.body;
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      throw new BadRequestError('Email and password required');
    }

    const result = await authService.loginWithTotp(email, password, totpCode);
    if ('requiresTotp' in result && result.requiresTotp) {
      return res.json({ requiresTotp: true });
    }
    res.json({
      user: { id: result.user!._id, email: result.user!.email },
      encryptedMasterKey: result.user!.encryptedMasterKey,
      ...result.tokens!,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/2fa/setup', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const user = await User.findById(userId);
    if (!user) throw new UnauthorizedError('User not found');
    if (user.totpEnabled) throw new BadRequestError('2FA already enabled');

    const secret = generateSecret();
    await User.findByIdAndUpdate(userId, { totpSecret: secret });

    const appName = process.env.APP_NAME || 'Share Anywhere';
    const otpauth = generateURI({ issuer: appName, label: user.email, secret });
    const qrDataUrl = await QRCode.toDataURL(otpauth);

    res.json({ qrDataUrl, secret });
  } catch (err) {
    next(err);
  }
});

router.post('/2fa/verify', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { code } = req.body;
    if (!code || typeof code !== 'string') throw new BadRequestError('Code required');

    const user = await User.findById(userId);
    if (!user || !user.totpSecret) throw new BadRequestError('2FA not set up');
    if (user.totpEnabled) throw new BadRequestError('2FA already enabled');

    const valid = verify({ token: code.trim(), secret: user.totpSecret });
    if (!valid) throw new UnauthorizedError('Invalid code');

    await User.findByIdAndUpdate(userId, { totpEnabled: true });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/2fa/disable', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { password } = req.body;
    if (!password || typeof password !== 'string') throw new BadRequestError('Password required');

    const user = await User.findById(userId);
    if (!user) throw new UnauthorizedError('User not found');
    const bcrypt = (await import('bcryptjs')).default;
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) throw new UnauthorizedError('Invalid password');

    await User.findByIdAndUpdate(userId, { $unset: { totpSecret: 1, totpEnabled: 1 } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new BadRequestError('Refresh token required');
    }

    const tokens = await authService.refreshAccessToken(refreshToken);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const { User } = await import('../models/User');
    const user = await User.findById(req.user.userId).select('email encryptedMasterKey deletedRetentionDays totpEnabled isAdmin').lean();
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    res.json({
      user: { id: req.user.userId, email: user.email, isAdmin: user.isAdmin ?? false },
      encryptedMasterKey: user.encryptedMasterKey,
      deletedRetentionDays: user.deletedRetentionDays ?? 30,
      totpEnabled: user.totpEnabled ?? false,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/me', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const { deletedRetentionDays } = req.body;
    const validDays = [7, 14, 30, 60];
    if (deletedRetentionDays !== undefined) {
      const days = parseInt(String(deletedRetentionDays), 10);
      if (!validDays.includes(days)) {
        throw new BadRequestError('deletedRetentionDays must be 7, 14, 30, or 60');
      }
      const { User } = await import('../models/User');
      await User.findByIdAndUpdate(req.user.userId, { deletedRetentionDays: days });
    }
    const { User } = await import('../models/User');
    const user = await User.findById(req.user.userId).select('email encryptedMasterKey deletedRetentionDays').lean();
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    res.json({
      deletedRetentionDays: user.deletedRetentionDays ?? 30,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
