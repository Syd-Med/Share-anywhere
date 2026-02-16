import { Router } from 'express';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { authMiddleware, AuthRequest } from '../middlewares/auth';
import { FileRequest } from '../models/FileRequest';
import { File } from '../models/File';
import { Folder } from '../models/Folder';
import { User } from '../models/User';
import { getUploadPresignedUrl } from '../services/s3';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { enqueueThumbnail } from '../workers/thumbnailProcessor';

const router = Router();

function generateToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

function getS3Key(userId: string, fileId: string, fileName: string): string {
  const ext = fileName.includes('.') ? fileName.split('.').pop() : '';
  const base = ext ? fileName.slice(0, -(ext.length + 1)) : fileName;
  const safe = base.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `users/${userId}/${fileId}${ext ? '.' + ext : ''}`;
}

router.post('/', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { folderId, expiresInDays, maxFiles } = req.body;

    if (folderId) {
      const folder = await Folder.findOne({ _id: folderId, userId });
      if (!folder) throw new NotFoundError('Folder not found');
    }

    const days = Math.min(90, Math.max(1, parseInt(String(expiresInDays || 7), 10) || 7));
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const max = maxFiles != null ? Math.min(100, Math.max(1, parseInt(String(maxFiles), 10) || 1)) : undefined;

    const token = generateToken();
    await FileRequest.create({
      userId,
      folderId: folderId || null,
      token,
      expiresAt,
      maxFiles: max,
    });

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.status(201).json({
      requestUrl: `${baseUrl}/request/${token}`,
      token,
      expiresAt,
      maxFiles: max,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/public/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    const req_ = await FileRequest.findOne({
      token,
      expiresAt: { $gt: new Date() },
    }).lean();

    if (!req_) throw new NotFoundError('File request not found or expired');

    res.json({
      folderId: req_.folderId,
      expiresAt: req_.expiresAt,
      maxFiles: req_.maxFiles,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/public/:token/upload-url', async (req, res, next) => {
  try {
    const { token } = req.params;
    const { fileName, size, mimeType } = req.body;

    if (!fileName || typeof fileName !== 'string' || !size || typeof size !== 'number') {
      throw new BadRequestError('fileName and size required');
    }

    const req_ = await FileRequest.findOne({
      token,
      expiresAt: { $gt: new Date() },
    });

    if (!req_) throw new NotFoundError('File request not found or expired');

    if (req_.maxFiles != null) {
      const count = await File.countDocuments({ fileRequestId: req_._id });
      if (count >= req_.maxFiles) throw new BadRequestError('Max files reached for this request');
    }

    const user = await User.findById(req_.userId).populate('planId').lean();
    const plan = user?.planId as { storageLimitBytes?: number } | null;
    const limit = plan?.storageLimitBytes ?? 5 * 1024 * 1024 * 1024;
    const used = user?.storageUsed ?? 0;
    if (used + size > limit) {
      throw new BadRequestError('Storage quota exceeded');
    }

    if (req_.folderId) {
      const folder = await Folder.findById(req_.folderId);
      if (!folder || folder.userId.toString() !== req_.userId.toString()) {
        throw new NotFoundError('Folder not found');
      }
    }

    const fileId = new Types.ObjectId().toString();
    const s3Key = getS3Key(req_.userId.toString(), fileId, fileName);

    const file = await File.create({
      userId: req_.userId,
      folderId: req_.folderId || null,
      s3Key,
      name: fileName,
      mimeType: mimeType || 'application/octet-stream',
      size,
      fileRequestId: req_._id,
    });

    const uploadUrl = await getUploadPresignedUrl(s3Key, mimeType || 'application/octet-stream');

    res.json({
      fileId: file._id,
      uploadUrl,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/public/:token/complete', async (req, res, next) => {
  try {
    const { token } = req.params;
    const { fileId } = req.body;

    if (!fileId) throw new BadRequestError('fileId required');

    const req_ = await FileRequest.findOne({
      token,
      expiresAt: { $gt: new Date() },
    });

    if (!req_) throw new NotFoundError('File request not found or expired');

    const file = await File.findOne({ _id: fileId, userId: req_.userId, fileRequestId: req_._id });
    if (!file) throw new NotFoundError('File not found');

    await User.findByIdAndUpdate(req_.userId, { $inc: { storageUsed: file.size } });

    if (file.mimeType.startsWith('image/') || file.mimeType.startsWith('video/')) {
      enqueueThumbnail({
        fileId: file._id.toString(),
        s3Key: file.s3Key,
        mimeType: file.mimeType,
      }).catch((err) => console.error('Thumbnail enqueue failed', err));
    }

    res.json({ success: true, file: { id: file._id, name: file.name, size: file.size } });
  } catch (err) {
    next(err);
  }
});

export default router;
