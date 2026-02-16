import { Types } from 'mongoose';
import { AuditLog } from '../models/AuditLog';

export async function logAudit(
  adminId: string,
  action: string,
  targetType: string,
  targetId?: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  await AuditLog.create({
    adminId: new Types.ObjectId(adminId),
    action,
    targetType,
    targetId: targetId ?? undefined,
    metadata,
  });
}
