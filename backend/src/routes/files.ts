import { Router } from 'express';
import { Types } from 'mongoose';
import { authMiddleware, AuthRequest } from '../middlewares/auth';
import { File } from '../models/File';
import { Folder } from '../models/Folder';
import { User } from '../models/User';
import { getUploadPresignedUrl, getDownloadPresignedUrl, getThumbnailPresignedUrl } from '../services/s3';
import { enqueueThumbnail } from '../workers/thumbnailProcessor';
import { getFolderPermission, getFileFolderPermission, permissionAllows } from '../services/folderAccess';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errors';
const router = Router();
router.use(authMiddleware);

function getS3Key(userId: string, fileId: string, fileName: string): string {
  const ext = fileName.includes('.') ? fileName.split('.').pop() : '';
  const base = ext ? fileName.slice(0, -(ext.length + 1)) : fileName;
  const safe = base.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `users/${userId}/${fileId}${ext ? '.' + ext : ''}`;
}

router.post('/upload-url', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { fileName, folderId, size, mimeType, encryptedFileKey } = req.body;

    if (!fileName || typeof fileName !== 'string' || !size || typeof size !== 'number') {
      throw new BadRequestError('fileName and size required');
    }

    const { Plan } = await import('../models/Plan');
    const user = await User.findById(userId).populate('planId').lean();
    const plan = user?.planId as { storageLimitBytes?: number } | null;
    const limit = plan?.storageLimitBytes ?? 5 * 1024 * 1024 * 1024; // 5GB default
    const used = user?.storageUsed ?? 0;
    if (used + size > limit) {
      throw new BadRequestError('Storage quota exceeded. Please upgrade your plan.');
    }
    // encryptedFileKey required for Phase 3+ encrypted uploads

    if (folderId) {
      const perm = await getFolderPermission(userId, folderId);
      if (!permissionAllows(perm, 'write')) throw new NotFoundError('Folder not found');
      const folder = await Folder.findById(folderId);
      if (!folder) throw new NotFoundError('Folder not found');
    }

    const fileId = new Types.ObjectId().toString();
    const s3Key = getS3Key(userId, fileId, fileName);

    const file = await File.create({
      userId,
      folderId: folderId || null,
      s3Key,
      ...(encryptedFileKey && { encryptedFileKey }),
      name: fileName,
      mimeType: mimeType || 'application/octet-stream',
      size,
    });

    const uploadUrl = await getUploadPresignedUrl(s3Key, file.mimeType);

    res.json({
      fileId: file._id,
      uploadUrl,
      s3Key,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/complete', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { fileId } = req.body;

    if (!fileId) throw new BadRequestError('fileId required');

    const file = await File.findOne({ _id: fileId, userId });
    if (!file) throw new NotFoundError('File not found');

    await User.findByIdAndUpdate(userId, { $inc: { storageUsed: file.size } });

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

router.get('/storage/usage', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const user = await User.findById(userId).select('storageUsed').lean();
    if (!user) throw new NotFoundError('User not found');
    res.json({ storageUsed: user.storageUsed || 0 });
  } catch (err) {
    next(err);
  }
});

router.get('/check-name', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const folderId = (req.query.folderId as string) || null;
    const fileName = req.query.fileName as string;

    if (!fileName || typeof fileName !== 'string' || !fileName.trim()) {
      throw new BadRequestError('fileName required');
    }

    let targetUserId = userId;
    if (folderId) {
      const perm = await getFolderPermission(userId, folderId);
      if (!permissionAllows(perm, 'write')) throw new NotFoundError('Folder not found');
      const folder = await Folder.findById(folderId).lean();
      if (!folder) throw new NotFoundError('Folder not found');
      targetUserId = folder.userId.toString();
    }

    const exists = await File.exists({
      userId: targetUserId,
      folderId: folderId || null,
      name: fileName.trim(),
      deletedAt: null,
    });

    res.json({ exists: !!exists });
  } catch (err) {
    next(err);
  }
});

router.get('/names', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const folderId = (req.query.folderId as string) || null;

    let targetUserId = userId;
    if (folderId) {
      const perm = await getFolderPermission(userId, folderId);
      if (!permissionAllows(perm, 'write')) throw new NotFoundError('Folder not found');
      const folder = await Folder.findById(folderId).lean();
      if (!folder) throw new NotFoundError('Folder not found');
      targetUserId = folder.userId.toString();
    }

    const files = await File.find({
      userId: targetUserId,
      folderId: folderId || null,
      deletedAt: null,
    })
      .select('name')
      .limit(2000)
      .lean();

    res.json({ names: files.map((f) => f.name) });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const folderId = (req.query.folderId as string) || null;
    const includeDeleted = req.query.includeDeleted === 'true';
    const search = (req.query.search as string) || '';
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '50', 10)));
    const sortBy = (req.query.sort as string) || 'createdAt';
    const order = (req.query.order as string) === 'asc' ? 1 : -1;

    let folderPermission: string | null = null;
    if (folderId) {
      folderPermission = await getFolderPermission(userId, folderId);
      if (!folderPermission) throw new UnauthorizedError('Folder not found');
    }

    const fileQuery: Record<string, unknown> = {};
    fileQuery.folderId = folderId || null;
    if (folderId) {
      const { Folder } = await import('../models/Folder');
      const folder = await Folder.findById(folderId).lean();
      if (folder) fileQuery.userId = folder.userId;
    } else {
      fileQuery.userId = userId;
    }
    if (!includeDeleted) fileQuery.deletedAt = null;
    if (search) {
      fileQuery.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }

    const validSort: Record<string, string> = {
      name: 'name',
      size: 'size',
      createdAt: 'createdAt',
      mimeType: 'mimeType',
    };
    const sortField = validSort[sortBy] || 'createdAt';
    const sortOpt: Record<string, 1 | -1> = { [sortField]: order };

    const [files, total] = await Promise.all([
      File.find(fileQuery).sort(sortOpt).skip((page - 1) * limit).limit(limit).lean(),
      File.countDocuments(fileQuery),
    ]);
    const ownerId = folderId
      ? (await Folder.findById(folderId).select('userId').lean())?.userId ?? userId
      : userId;
    const folders = await Folder.find({
      userId: ownerId,
      parentId: folderId || null,
    }).lean();

    res.json({
      folderPermission: folderPermission || undefined,
      files: files.map((f) => ({
        id: f._id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        folderId: f.folderId,
        thumbnailKey: f.thumbnailKey,
        deletedAt: f.deletedAt,
        createdAt: f.createdAt,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      folders: folders.map((f) => ({
        id: f._id,
        name: f.name,
        parentId: f.parentId,
        path: f.path,
        createdAt: f.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/thumbnail-url', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const { permission } = await getFileFolderPermission(userId, id);
    if (!permissionAllows(permission, 'read')) throw new NotFoundError('File not found');
    const file = await File.findById(id);
    if (!file || file.deletedAt) throw new NotFoundError('File not found');
    if (!file.thumbnailKey) throw new NotFoundError('No thumbnail');

    const url = await getThumbnailPresignedUrl(file.thumbnailKey);
    res.json({ thumbnailUrl: url });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/download-url', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const { permission } = await getFileFolderPermission(userId, id);
    if (!permissionAllows(permission, 'read')) throw new NotFoundError('File not found');
    const file = await File.findById(id);
    if (!file || file.deletedAt) throw new NotFoundError('File not found');

    const url = await getDownloadPresignedUrl(file.s3Key);
    res.json({
      downloadUrl: url,
      name: file.name,
      mimeType: file.mimeType,
      encryptedFileKey: file.encryptedFileKey,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/move', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { folderId } = req.body;

    const { permission } = await getFileFolderPermission(userId, id);
    if (!permissionAllows(permission, 'write')) throw new NotFoundError('File not found');
    const file = await File.findById(id);
    if (!file) throw new NotFoundError('File not found');
    if (file.deletedAt) throw new BadRequestError('Cannot move deleted file');

    const targetFolderId = folderId === '' || folderId === undefined ? null : folderId;
    if (targetFolderId) {
      const targetPerm = await getFolderPermission(userId, targetFolderId);
      if (!permissionAllows(targetPerm, 'write')) throw new NotFoundError('Target folder not found');
      const folder = await Folder.findById(targetFolderId);
      if (!folder) throw new NotFoundError('Target folder not found');
      if (folder.userId.toString() !== file.userId.toString()) {
        throw new BadRequestError('Cannot move file to a different owner\'s folder');
      }
    }

    await File.findByIdAndUpdate(id, { folderId: targetFolderId });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/rename', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new BadRequestError('Valid name required');
    }

    const { permission } = await getFileFolderPermission(userId, id);
    if (!permissionAllows(permission, 'write')) throw new NotFoundError('File not found');
    const file = await File.findById(id);
    if (!file) throw new NotFoundError('File not found');
    if (file.deletedAt) throw new BadRequestError('Cannot rename deleted file');

    await File.findByIdAndUpdate(id, { name: name.trim() });
    res.json({ success: true, name: name.trim() });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/delete', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const { permission } = await getFileFolderPermission(userId, id);
    if (!permissionAllows(permission, 'delete')) throw new NotFoundError('File not found');
    const file = await File.findById(id);
    if (!file) throw new NotFoundError('File not found');
    if (file.deletedAt) throw new BadRequestError('Already deleted');

    await File.findByIdAndUpdate(id, { deletedAt: new Date() });
    await User.findByIdAndUpdate(file.userId, { $inc: { storageUsed: -file.size } });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/restore', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const { permission } = await getFileFolderPermission(userId, id);
    if (!permissionAllows(permission, 'delete')) throw new NotFoundError('File not found');
    const file = await File.findById(id);
    if (!file) throw new NotFoundError('File not found');
    if (!file.deletedAt) throw new BadRequestError('Not deleted');

    await File.findByIdAndUpdate(id, { deletedAt: null });
    await User.findByIdAndUpdate(file.userId, { $inc: { storageUsed: file.size } });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
