import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { apiKeyMiddleware, APIKeyRequest, requireScope } from '../../middlewares/apiKeyAuth';
import { File } from '../../models/File';
import { Folder } from '../../models/Folder';
import { User } from '../../models/User';
import { getUploadPresignedUrl, getDownloadPresignedUrl } from '../../services/s3';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { Types } from 'mongoose';

const router = Router();

router.use(apiKeyMiddleware);
router.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    keyGenerator: (req) => (req as APIKeyRequest).apiKey?.keyId ?? req.ip ?? 'unknown',
    standardHeaders: true,
  })
);

router.get('/files', requireScope('files:read'), async (req: APIKeyRequest, res, next) => {
  try {
    const userId = req.apiKey!.userId;
    const folderId = (req.query.folderId as string) || null;

    const files = await File.find({
      userId,
      folderId: folderId || null,
      deletedAt: null,
    })
      .select('name mimeType size createdAt')
      .lean();

    res.json({ files });
  } catch (err) {
    next(err);
  }
});

router.post('/files/upload-url', requireScope('files:write'), async (req: APIKeyRequest, res, next) => {
  try {
    const userId = req.apiKey!.userId;
    const { fileName, folderId, size } = req.body;

    if (!fileName || typeof fileName !== 'string' || !size || typeof size !== 'number') {
      throw new BadRequestError('fileName and size required');
    }

    const fileId = new Types.ObjectId().toString();
    const s3Key = `users/${userId}/${fileId}`;

    const file = await File.create({
      userId,
      folderId: folderId || null,
      s3Key,
      name: fileName,
      size,
      mimeType: 'application/octet-stream',
    });

    const uploadUrl = await getUploadPresignedUrl(s3Key);
    res.json({ fileId: file._id, uploadUrl });
  } catch (err) {
    next(err);
  }
});

router.get('/files/:id/download-url', requireScope('files:read'), async (req: APIKeyRequest, res, next) => {
  try {
    const userId = req.apiKey!.userId;
    const { id } = req.params;

    const file = await File.findOne({ _id: id, userId, deletedAt: null });
    if (!file) throw new NotFoundError('File not found');

    const url = await getDownloadPresignedUrl(file.s3Key);
    res.json({ downloadUrl: url, name: file.name });
  } catch (err) {
    next(err);
  }
});

export default router;
