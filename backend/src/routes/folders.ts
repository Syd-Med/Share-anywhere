import { Router } from 'express';
import { Types } from 'mongoose';
import { authMiddleware, AuthRequest } from '../middlewares/auth';
import { Folder } from '../models/Folder';
import { FolderShare } from '../models/FolderShare';
import { User } from '../models/User';
import { getFolderPermission, permissionAllows } from '../services/folderAccess';
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from '../utils/errors';

const router = Router();
router.use(authMiddleware);

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { name, parentId } = req.body;

    if (!name || typeof name !== 'string') {
      throw new BadRequestError('Folder name required');
    }

    let path = '/' + name.replace(/\/|\.\./g, '');
    const parentIdVal = parentId || null;

    let ownerId = userId;
    if (parentIdVal) {
      const perm = await getFolderPermission(userId, parentIdVal);
      if (!permissionAllows(perm, 'write')) throw new NotFoundError('Parent folder not found');
      const parent = await Folder.findById(parentIdVal);
      if (!parent) throw new NotFoundError('Parent folder not found');
      path = parent.path + name + '/';
      ownerId = parent.userId.toString();
    }

    const existing = await Folder.findOne({
      userId: ownerId,
      parentId: parentIdVal,
      name,
    });
    if (existing) throw new ConflictError('Folder already exists');

    const folder = await Folder.create({
      userId: ownerId,
      parentId: parentIdVal,
      name,
      path,
    });

    res.status(201).json({
      id: folder._id,
      name: folder.name,
      parentId: folder.parentId,
      path: folder.path,
      createdAt: folder.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const folders = await Folder.find({ userId }).sort({ path: 1 }).lean();
    res.json({
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

router.get('/shared-with-me', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const shares = await FolderShare.find({ sharedWithUserId: userId })
      .populate('folderId')
      .populate('ownerId', 'email')
      .sort({ createdAt: -1 })
      .lean();

    const result = shares
      .filter((s) => s.folderId)
      .map((s) => {
        const folder = s.folderId as unknown as { _id: Types.ObjectId; name: string; path: string; parentId: Types.ObjectId | null };
        const owner = s.ownerId as { email?: string };
        return {
          id: folder._id,
          name: folder.name,
          path: folder.path,
          parentId: folder.parentId,
          sharedBy: owner?.email,
          permission: s.permission,
          createdAt: s.createdAt,
        };
      });

    res.json({ folders: result });
  } catch (err) {
    next(err);
  }
});

router.get('/shared-by-me', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const shares = await FolderShare.find({ ownerId: userId })
      .populate('folderId')
      .populate('sharedWithUserId', 'email')
      .sort({ createdAt: -1 })
      .lean();

    const result = shares
      .filter((s) => s.folderId)
      .map((s) => {
        const folder = s.folderId as unknown as { _id: Types.ObjectId; name: string; path: string };
        const sharedWith = s.sharedWithUserId as { _id: Types.ObjectId; email?: string };
        return {
          id: s._id,
          folderId: folder._id,
          folderName: folder.name,
          folderPath: folder.path,
          sharedWithEmail: sharedWith?.email,
          sharedWithUserId: sharedWith?._id,
          permission: s.permission,
          createdAt: s.createdAt,
        };
      });

    res.json({ shares: result });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/share', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { email, permission } = req.body;

    const perm = await getFolderPermission(userId, id);
    if (!permissionAllows(perm, 'share')) throw new UnauthorizedError('Cannot share this folder');

    const folder = await Folder.findById(id);
    if (!folder) throw new NotFoundError('Folder not found');
    if (folder.userId.toString() !== userId) throw new UnauthorizedError('Not the folder owner');

    if (!email || typeof email !== 'string') throw new BadRequestError('Email required');
    const targetUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (!targetUser) throw new NotFoundError('User not found');
    if (targetUser._id.toString() === userId) throw new BadRequestError('Cannot share with yourself');

    const permVal = ['read', 'read_write', 'full'].includes(permission) ? permission : 'read';

    const existing = await FolderShare.findOne({
      folderId: id,
      sharedWithUserId: targetUser._id,
    });
    if (existing) {
      await FolderShare.updateOne({ _id: existing._id }, { permission: permVal });
      return res.json({ success: true, updated: true });
    }

    await FolderShare.create({
      folderId: id,
      ownerId: userId,
      sharedWithUserId: targetUser._id,
      permission: permVal,
    });
    res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/shares', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const perm = await getFolderPermission(userId, id);
    if (!permissionAllows(perm, 'share')) throw new UnauthorizedError('Cannot view shares');

    const shares = await FolderShare.find({ folderId: id })
      .populate('sharedWithUserId', 'email')
      .lean();

    res.json({
      shares: shares.map((s) => ({
        userId: (s.sharedWithUserId as { _id: Types.ObjectId; email?: string })?._id,
        email: (s.sharedWithUserId as { _id: Types.ObjectId; email?: string })?.email,
        permission: s.permission,
        createdAt: s.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/share/:userId', async (req: AuthRequest, res, next) => {
  try {
    const currentUserId = req.user!.userId;
    const { id, userId: targetUserId } = req.params;
    const { permission } = req.body;

    const perm = await getFolderPermission(currentUserId, id);
    if (!permissionAllows(perm, 'share')) throw new UnauthorizedError('Cannot update share');

    const permVal = ['read', 'read_write', 'full'].includes(permission) ? permission : 'read';
    const updated = await FolderShare.findOneAndUpdate(
      { folderId: id, sharedWithUserId: targetUserId, ownerId: currentUserId },
      { permission: permVal }
    );
    if (!updated) throw new NotFoundError('Share not found');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/share/:userId', async (req: AuthRequest, res, next) => {
  try {
    const currentUserId = req.user!.userId;
    const { id, userId: targetUserId } = req.params;

    const perm = await getFolderPermission(currentUserId, id);
    if (!permissionAllows(perm, 'share')) throw new UnauthorizedError('Cannot revoke share');

    const deleted = await FolderShare.findOneAndDelete({
      folderId: id,
      sharedWithUserId: targetUserId,
      ownerId: currentUserId,
    });
    if (!deleted) throw new NotFoundError('Share not found');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/breadcrumbs', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const folderId = req.query.folderId as string | undefined;

    if (!folderId) {
      return res.json({ breadcrumbs: [] });
    }

    const perm = await getFolderPermission(userId, folderId);
    if (!perm) throw new NotFoundError('Folder not found');

    const folder = await Folder.findById(folderId);
    if (!folder) throw new NotFoundError('Folder not found');
    const ownerId = folder.userId.toString();

    const parts = folder.path.split('/').filter(Boolean);
    const breadcrumbs: Array<{ id: string; name: string }> = [];
    let currentPath = '';

    for (const name of parts) {
      currentPath += '/' + name + '/';
      const f = await Folder.findOne({ userId: ownerId, path: currentPath }).lean();
      if (f) breadcrumbs.push({ id: f._id.toString(), name: f.name });
    }

    res.json({ breadcrumbs });
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

    const perm = await getFolderPermission(userId, id);
    if (!permissionAllows(perm, 'write')) throw new NotFoundError('Folder not found');

    const folder = await Folder.findById(id);
    if (!folder) throw new NotFoundError('Folder not found');
    const ownerId = folder.userId.toString();

    const existing = await Folder.findOne({
      userId: ownerId,
      parentId: folder.parentId,
      name: name.trim(),
      _id: { $ne: id },
    });
    if (existing) throw new ConflictError('Folder with that name already exists');

    const oldPath = folder.path;
    const newName = name.trim();
    const parentPath = folder.path.slice(0, -folder.name.length - 1);
    const newPath = (parentPath ? parentPath + '/' : '/') + newName + '/';

    await Folder.updateOne(
      { _id: id, userId: ownerId },
      { $set: { name: newName, path: newPath } }
    );
    const escaped = oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const descendants = await Folder.find({
      userId: ownerId,
      path: { $regex: `^${escaped}` },
      _id: { $ne: id },
    });
    for (const d of descendants) {
      await Folder.updateOne(
        { _id: d._id },
        { $set: { path: d.path.replace(oldPath, newPath) } }
      );
    }

    res.json({ success: true, name: newName });
  } catch (err) {
    next(err);
  }
});

export default router;
