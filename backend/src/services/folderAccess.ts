import { Types } from 'mongoose';
import { Folder } from '../models/Folder';
import { FolderShare } from '../models/FolderShare';
import { FolderSharePermission } from '../models/FolderShare';

export async function getFolderPermission(
  userId: string,
  folderId: string
): Promise<'owner' | FolderSharePermission | null> {
  const folder = await Folder.findById(folderId).lean();
  if (!folder) return null;
  if (folder.userId.toString() === userId) return 'owner';

  const share = await FolderShare.findOne({
    folderId: new Types.ObjectId(folderId),
    sharedWithUserId: new Types.ObjectId(userId),
  }).lean();
  if (!share) return null;
  return share.permission as FolderSharePermission;
}

export function permissionAllows(perm: 'owner' | FolderSharePermission | null, action: 'read' | 'write' | 'delete' | 'share'): boolean {
  if (!perm) return false;
  if (perm === 'owner') return true;
  if (action === 'read') return true;
  if (action === 'write') return perm === 'read_write' || perm === 'full';
  if (action === 'delete' || action === 'share') return perm === 'full';
  return false;
}

export async function getFileFolderPermission(
  userId: string,
  fileId: string
): Promise<{ folderId: string | null; permission: 'owner' | FolderSharePermission | null }> {
  const { File } = await import('../models/File');
  const file = await File.findById(fileId).lean();
  if (!file) return { folderId: null, permission: null };
  if (file.userId.toString() === userId) return { folderId: file.folderId?.toString() ?? null, permission: 'owner' };
  if (!file.folderId) return { folderId: null, permission: null };
  const perm = await getFolderPermission(userId, file.folderId.toString());
  return { folderId: file.folderId.toString(), permission: perm };
}
