import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { authMiddleware, AuthRequest } from '../middlewares/auth';
import { ShareLink } from '../models/ShareLink';
import { File } from '../models/File';
import { getDownloadPresignedUrl } from '../services/s3';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errors';

const router = Router();
const SALT_ROUNDS = 10;

function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

router.post('/', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { fileId, expiresAt, password, token: clientToken, shareEncryptedFileKey, permission } = req.body;

    if (!fileId || !shareEncryptedFileKey || typeof shareEncryptedFileKey !== 'string') {
      throw new BadRequestError('fileId and shareEncryptedFileKey required');
    }

    const file = await File.findOne({ _id: fileId, userId, deletedAt: null });
    if (!file) throw new NotFoundError('File not found');

    const exp = expiresAt ? new Date(expiresAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    if (exp <= new Date()) throw new BadRequestError('Expiry must be in the future');

    const token = clientToken && typeof clientToken === 'string' && clientToken.length >= 32
      ? clientToken
      : generateToken();
    let passwordHash: string | undefined;
    if (password && typeof password === 'string' && password.length > 0) {
      passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    }

    const perm = permission === 'read' ? 'read' : 'full';
    await ShareLink.create({
      fileId,
      userId,
      token,
      passwordHash,
      shareEncryptedFileKey,
      permission: perm,
      expiresAt: exp,
    });

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.status(201).json({
      shareUrl: `${baseUrl}/share/${token}`,
      token,
      expiresAt: exp,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/public/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.query;

    const share = await ShareLink.findOne({
      token,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    }).populate('fileId');

    if (!share) throw new NotFoundError('Share link not found or expired');

    const file = share.fileId as unknown as { _id: unknown; name: string; mimeType: string; s3Key: string; size: number };
    if (!file) throw new NotFoundError('File not found');

    if (share.passwordHash) {
      if (!password || typeof password !== 'string') {
        return res.status(401).json({
          requiresPassword: true,
          message: 'Password required',
        });
      }
      const match = await bcrypt.compare(password, share.passwordHash);
      if (!match) {
        throw new UnauthorizedError('Invalid password');
      }
    }

    const downloadUrl = await getDownloadPresignedUrl(file.s3Key);

    res.json({
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      downloadUrl,
      shareEncryptedFileKey: share.shareEncryptedFileKey,
      hasPassword: !!share.passwordHash,
      permission: share.permission || 'full',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const shares = await ShareLink.find({ userId, revokedAt: null })
      .populate('fileId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.json({
      shares: shares.map((s) => ({
        id: s._id,
        fileId: s.fileId,
        fileName: (s.fileId as { name?: string })?.name,
        token: s.token,
        shareUrl: `${baseUrl}/share/${s.token}`,
        expiresAt: s.expiresAt,
        hasPassword: !!s.passwordHash,
        permission: s.permission || 'full',
        createdAt: s.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:token', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { token } = req.params;
    const { permission } = req.body;

    const share = await ShareLink.findOne({ token, userId });
    if (!share) throw new NotFoundError('Share not found');

    const perm = permission === 'read' ? 'read' : 'full';
    await ShareLink.updateOne({ token, userId }, { permission: perm });
    res.json({ success: true, permission: perm });
  } catch (err) {
    next(err);
  }
});

router.patch('/:token/revoke', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { token } = req.params;

    const share = await ShareLink.findOne({ token, userId });
    if (!share) throw new NotFoundError('Share not found');

    await ShareLink.updateOne({ token, userId }, { revokedAt: new Date() });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
