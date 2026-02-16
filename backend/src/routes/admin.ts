import { Router } from 'express';
import { Types } from 'mongoose';
import { authMiddleware, AuthRequest } from '../middlewares/auth';
import { adminMiddleware } from '../middlewares/adminAuth';
import { User } from '../models/User';
import { File } from '../models/File';
import { ShareLink } from '../models/ShareLink';
import { FolderShare } from '../models/FolderShare';
import { Folder } from '../models/Folder';
import { FileRequest } from '../models/FileRequest';
import { Plan } from '../models/Plan';
import { APIKey } from '../models/APIKey';
import { AuditLog } from '../models/AuditLog';
import { Config } from '../models/Config';
import mongoose from 'mongoose';
import { getRedisClient } from '../db/redis';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { logAudit } from '../utils/audit';
import { deleteFromS3 } from '../services/s3';

const router = Router();
router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/stats', async (_req, res, next) => {
  try {
    const [userCount, fileCount, shareCount, fileRequestsCount, folderSharesCount, storageAgg, storageByPlanAgg] = await Promise.all([
      User.countDocuments(),
      File.countDocuments({ deletedAt: null }),
      ShareLink.countDocuments({ revokedAt: null, expiresAt: { $gt: new Date() } }),
      FileRequest.countDocuments({ expiresAt: { $gt: new Date() } }),
      FolderShare.countDocuments(),
      User.aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: '$storageUsed' } } }]),
      User.aggregate<{ _id: Types.ObjectId | null; storage: number }>([
        { $group: { _id: '$planId', storage: { $sum: '$storageUsed' } } },
      ]),
    ]);
    const storageTotalUsed = storageAgg[0]?.total ?? 0;
    const plans = await Plan.find().select('_id name').lean();
    const planMap = new Map(plans.map((p) => [p._id.toString(), p.name]));
    const storageByPlan = storageByPlanAgg.map((s) => ({
      planId: s._id,
      planName: s._id ? planMap.get(s._id.toString()) ?? null : 'No plan',
      storageBytes: s.storage,
    }));
    const recentSignups = await User.find()
      .select('email createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    res.json({
      userCount,
      fileCount,
      shareCount,
      fileRequestsCount,
      folderSharesCount,
      storageTotalUsed,
      storageByPlan,
      recentSignups: recentSignups.map((u) => ({ email: u.email, createdAt: u.createdAt })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/storage', async (_req, res, next) => {
  try {
    const [topUsers, storageByPlanAgg] = await Promise.all([
      User.find()
        .select('email storageUsed planId')
        .populate('planId', 'name')
        .sort({ storageUsed: -1 })
        .limit(20)
        .lean(),
      User.aggregate<{ _id: Types.ObjectId | null; storage: number; count: number }>([
        { $group: { _id: '$planId', storage: { $sum: '$storageUsed' }, count: { $sum: 1 } } },
      ]),
    ]);
    const plans = await Plan.find().select('_id name').lean();
    const planMap = new Map(plans.map((p) => [p._id.toString(), p.name]));
    res.json({
      topUsers: topUsers.map((u) => ({
        id: u._id,
        email: u.email,
        storageUsed: u.storageUsed || 0,
        planName: (u.planId as { name?: string })?.name ?? null,
      })),
      storageByPlan: storageByPlanAgg.map((s) => ({
        planId: s._id,
        planName: s._id ? planMap.get(s._id.toString()) ?? null : 'No plan',
        storageBytes: s.storage,
        userCount: s.count,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/health', async (_req, res, next) => {
  try {
    const mongoOk = mongoose.connection.readyState === 1;
    let redisOk = false;
    let s3Ok = false;
    try {
      const redis = await getRedisClient();
      await redis.ping();
      redisOk = true;
    } catch {
      /* ignore */
    }
    try {
      const { S3Client, HeadBucketCommand } = await import('@aws-sdk/client-s3');
      const { config } = await import('../config');
      const client = new S3Client({ region: config.awsRegion });
      await client.send(new HeadBucketCommand({ Bucket: config.s3Bucket }));
      s3Ok = true;
    } catch {
      /* ignore */
    }
    res.json({ mongo: mongoOk, redis: redisOk, s3: s3Ok, ok: mongoOk });
  } catch (err) {
    next(err);
  }
});

router.get('/config', async (_req, res, next) => {
  try {
    const docs = await Config.find().lean();
    const config: Record<string, string> = {};
    for (const d of docs) config[d.key] = d.value;
    res.json({ config, keys: Object.keys(config) });
  } catch (err) {
    next(err);
  }
});

router.patch('/config', async (req: AuthRequest, res, next) => {
  try {
    const { key, value } = req.body;
    if (!key || typeof key !== 'string' || !key.trim()) throw new BadRequestError('key required');
    await Config.findOneAndUpdate(
      { key: key.trim() },
      { value: typeof value === 'string' ? value : String(value ?? '') },
      { upsert: true, new: true }
    );
    await logAudit(req.user!.userId, 'config.updated', 'config', key.trim(), { value: typeof value === 'string' ? value : String(value ?? '') });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/jobs', async (_req, res, next) => {
  try {
    const { thumbnailQueue } = await import('../workers/queues');
    const [waiting, active, completed, failed] = await Promise.all([
      thumbnailQueue.getWaitingCount(),
      thumbnailQueue.getActiveCount(),
      thumbnailQueue.getCompletedCount(),
      thumbnailQueue.getFailedCount(),
    ]);
    res.json({ thumbnail: { waiting, active, completed, failed } });
  } catch (err) {
    next(err);
  }
});

router.get('/shares', async (req, res, next) => {
  try {
    const userId = (req.query.userId as string) || '';
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '25', 10)));
    const query: Record<string, unknown> = {};
    if (userId) query.userId = new Types.ObjectId(userId);
    const [shares, total] = await Promise.all([
      ShareLink.find(query)
        .populate('userId', 'email')
        .populate('fileId', 'name size')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ShareLink.countDocuments(query),
    ]);
    res.json({
      shares: shares.map((s) => ({
        id: s._id,
        token: s.token,
        userId: (s.userId as { _id?: Types.ObjectId })?._id,
        userEmail: (s.userId as { email?: string })?.email ?? null,
        fileName: (s.fileId as { name?: string })?.name ?? null,
        fileSize: (s.fileId as { size?: number })?.size ?? null,
        permission: s.permission,
        expiresAt: s.expiresAt,
        revokedAt: s.revokedAt,
        createdAt: s.createdAt,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/shares/:token/revoke', async (req: AuthRequest, res, next) => {
  try {
    const { token } = req.params;
    const share = await ShareLink.findOne({ token });
    if (!share) throw new NotFoundError('Share not found');
    await ShareLink.updateOne({ token }, { revokedAt: new Date() });
    await logAudit(req.user!.userId, 'share.revoked', 'share', token);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/file-requests', async (req, res, next) => {
  try {
    const userId = (req.query.userId as string) || '';
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '25', 10)));
    const query: Record<string, unknown> = {};
    if (userId) query.userId = new Types.ObjectId(userId);
    const [requests, total] = await Promise.all([
      FileRequest.find(query)
        .populate('userId', 'email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      FileRequest.countDocuments(query),
    ]);
    const now = new Date();
    res.json({
      fileRequests: requests.map((r) => ({
        id: r._id,
        token: r.token,
        userId: (r.userId as { _id?: Types.ObjectId })?._id ?? r.userId,
        userEmail: (r.userId as { email?: string })?.email ?? null,
        expiresAt: r.expiresAt,
        maxFiles: r.maxFiles,
        createdAt: r.createdAt,
        expired: r.expiresAt < now,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/api-keys', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '25', 10)));
    const [keys, total] = await Promise.all([
      APIKey.find()
        .populate('userId', 'email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      APIKey.countDocuments(),
    ]);
    res.json({
      apiKeys: keys.map((k) => ({
        id: k._id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        userId: (k.userId as { _id?: Types.ObjectId })?._id ?? k.userId,
        userEmail: (k.userId as { email?: string })?.email ?? null,
        scopes: k.scopes,
        lastUsedAt: k.lastUsedAt,
        createdAt: k.createdAt,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/api-keys/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const key = await APIKey.findById(id);
    if (!key) throw new NotFoundError('API key not found');
    await APIKey.findByIdAndDelete(id);
    await logAudit(req.user!.userId, 'api_key.revoked', 'api_key', id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const search = (req.query.search as string) || '';
    const planId = (req.query.planId as string) || '';
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '25', 10)));

    const query: Record<string, unknown> = {};
    if (search.trim()) {
      query.email = { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }
    if (planId) {
      query.planId = planId === 'none' ? null : new Types.ObjectId(planId);
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('email storageUsed createdAt planId isAdmin disabledAt')
        .populate('planId', 'name storageLimitBytes')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    const userIds = users.map((u) => u._id);
    const fileCounts = await File.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { userId: { $in: userIds }, deletedAt: null } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(fileCounts.map((f) => [f._id.toString(), f.count]));

    res.json({
      users: users.map((u) => ({
        id: u._id,
        email: u.email,
        storageUsed: u.storageUsed || 0,
        createdAt: u.createdAt,
        isAdmin: u.isAdmin || false,
        disabledAt: u.disabledAt ?? null,
        planId: u.planId
          ? String((u.planId as { _id?: Types.ObjectId })._id ?? (u.planId as Types.ObjectId))
          : null,
        planName: (u.planId as unknown as { name?: string })?.name ?? null,
        storageLimitBytes: (u.planId as unknown as { storageLimitBytes?: number })?.storageLimitBytes ?? 5 * 1024 ** 3,
        fileCount: countMap.get(u._id.toString()) ?? 0,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).populate('planId').lean();
    if (!user) throw new NotFoundError('User not found');

    const [fileCount, apiKeyCount] = await Promise.all([
      File.countDocuments({ userId: id, deletedAt: null }),
      APIKey.countDocuments({ userId: id }),
    ]);

    const plan = user.planId as unknown as { _id?: { toString(): string }; name?: string; storageLimitBytes?: number } | null;
    res.json({
      id: user._id,
      email: user.email,
      storageUsed: user.storageUsed || 0,
      createdAt: user.createdAt,
      isAdmin: user.isAdmin || false,
      disabledAt: user.disabledAt ?? null,
      planId: plan?._id != null ? String(plan._id) : null,
      planName: plan?.name ?? null,
      storageLimitBytes: plan?.storageLimitBytes ?? 5 * 1024 ** 3,
      fileCount,
      apiKeyCount,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id/plan', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { planId } = req.body;
    if (planId !== null && planId !== undefined && planId !== '') {
      const plan = await Plan.findById(planId);
      if (!plan) throw new NotFoundError('Plan not found');
    }
    const user = await User.findById(id);
    if (!user) throw new NotFoundError('User not found');
    await User.findByIdAndUpdate(id, {
      planId: planId && planId !== '' ? planId : null,
    });
    await logAudit(req.user!.userId, 'user.plan.updated', 'user', id, { planId: planId && planId !== '' ? planId : null });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id/admin', async (req: AuthRequest, res, next) => {
  try {
    const adminUserId = req.user!.userId;
    const { id } = req.params;
    const { isAdmin } = req.body;
    if (id === adminUserId) throw new BadRequestError('Cannot change your own admin status');
    const user = await User.findById(id);
    if (!user) throw new NotFoundError('User not found');
    await User.findByIdAndUpdate(id, { isAdmin: !!isAdmin });
    await logAudit(req.user!.userId, 'user.admin.toggled', 'user', id, { isAdmin: !!isAdmin });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id/disable', async (req: AuthRequest, res, next) => {
  try {
    const adminUserId = req.user!.userId;
    const { id } = req.params;
    const { disabled } = req.body;
    if (id === adminUserId) throw new BadRequestError('Cannot disable your own account');
    const user = await User.findById(id);
    if (!user) throw new NotFoundError('User not found');
    await User.findByIdAndUpdate(id, { disabledAt: disabled ? new Date() : null });
    await logAudit(adminUserId, 'user.disabled', 'user', id, { disabled: !!disabled });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/users/:id', async (req: AuthRequest, res, next) => {
  try {
    const adminUserId = req.user!.userId;
    const { id } = req.params;
    if (id === adminUserId) throw new BadRequestError('Cannot delete your own account');
    const user = await User.findById(id);
    if (!user) throw new NotFoundError('User not found');

    const files = await File.find({ userId: id, deletedAt: null }).lean();
    for (const f of files) {
      try {
        await deleteFromS3(f.s3Key);
        if (f.thumbnailKey) await deleteFromS3(f.thumbnailKey);
      } catch {
        /* ignore S3 errors */
      }
    }
    await File.deleteMany({ userId: id });
    await ShareLink.deleteMany({ userId: id });
    await FolderShare.deleteMany({ $or: [{ ownerId: id }, { sharedWithUserId: id }] });
    await FileRequest.deleteMany({ userId: id });
    await APIKey.deleteMany({ userId: id });
    await Folder.deleteMany({ userId: id });
    await User.findByIdAndDelete(id);

    await logAudit(adminUserId, 'user.deleted', 'user', id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/plans', async (_req, res, next) => {
  try {
    const plans = await Plan.find().sort({ storageLimitBytes: 1 }).lean();
    const planIds = plans.map((p) => p._id);
    const subscriberCounts = await User.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { planId: { $in: planIds } } },
      { $group: { _id: '$planId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(subscriberCounts.map((s) => [s._id.toString(), s.count]));

    res.json({
      plans: plans.map((p) => ({
        id: p._id,
        name: p.name,
        stripePriceId: p.stripePriceId,
        storageLimitBytes: p.storageLimitBytes,
        checkoutUrl: p.checkoutUrl,
        createdAt: p.createdAt,
        subscriberCount: countMap.get(p._id.toString()) ?? 0,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/plans', async (req: AuthRequest, res, next) => {
  try {
    const { name, storageLimitBytes, stripePriceId, checkoutUrl } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) throw new BadRequestError('name required');
    if (!stripePriceId || typeof stripePriceId !== 'string' || !stripePriceId.trim())
      throw new BadRequestError('stripePriceId required');
    const bytes = typeof storageLimitBytes === 'number' ? storageLimitBytes : parseInt(String(storageLimitBytes), 10);
    if (isNaN(bytes) || bytes < 0) throw new BadRequestError('storageLimitBytes required');

    const plan = await Plan.create({
      name: name.trim(),
      stripePriceId: stripePriceId.trim(),
      storageLimitBytes: bytes,
      checkoutUrl: typeof checkoutUrl === 'string' && checkoutUrl.trim() ? checkoutUrl.trim() : undefined,
    });
    await logAudit(req.user!.userId, 'plan.created', 'plan', plan._id.toString(), { name: plan.name });
    res.status(201).json({
      id: plan._id,
      name: plan.name,
      stripePriceId: plan.stripePriceId,
      storageLimitBytes: plan.storageLimitBytes,
      checkoutUrl: plan.checkoutUrl,
      createdAt: plan.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/plans/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { name, storageLimitBytes, stripePriceId, checkoutUrl } = req.body;
    const plan = await Plan.findById(id);
    if (!plan) throw new NotFoundError('Plan not found');

    const updates: Record<string, unknown> = {};
    if (name !== undefined && typeof name === 'string' && name.trim()) updates.name = name.trim();
    if (storageLimitBytes !== undefined) {
      const bytes = typeof storageLimitBytes === 'number' ? storageLimitBytes : parseInt(String(storageLimitBytes), 10);
      if (!isNaN(bytes) && bytes >= 0) updates.storageLimitBytes = bytes;
    }
    if (stripePriceId !== undefined && typeof stripePriceId === 'string' && stripePriceId.trim())
      updates.stripePriceId = stripePriceId.trim();
    if (checkoutUrl !== undefined) updates.checkoutUrl = typeof checkoutUrl === 'string' ? checkoutUrl.trim() || undefined : undefined;

    await Plan.findByIdAndUpdate(id, updates);
    await logAudit(req.user!.userId, 'plan.updated', 'plan', id, updates);
    const updated = await Plan.findById(id).lean();
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/plans/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userCount = await User.countDocuments({ planId: id });
    if (userCount > 0) throw new BadRequestError('Cannot delete plan with active subscribers');
    const plan = await Plan.findByIdAndDelete(id);
    if (!plan) throw new NotFoundError('Plan not found');
    await logAudit(req.user!.userId, 'plan.deleted', 'plan', id, { name: plan.name });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/billing/overview', async (_req, res, next) => {
  try {
    const plans = await Plan.find().lean();
    const subscriberCounts = await User.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { planId: { $in: plans.map((p) => p._id) }, disabledAt: null } as Record<string, unknown> },
      { $group: { _id: '$planId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(subscriberCounts.map((s) => [s._id.toString(), s.count]));
    const activeSubscriptions = subscriberCounts.reduce((sum, s) => sum + s.count, 0);
    res.json({
      activeSubscriptions,
      planDistribution: plans.map((p) => ({
        planId: p._id,
        planName: p.name,
        subscriberCount: countMap.get(p._id.toString()) ?? 0,
      })),
      mrr: null,
      revenue: null,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/audit', async (req: AuthRequest, res, next) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '25', 10)));
    const action = (req.query.action as string) || '';
    const targetType = (req.query.targetType as string) || '';

    const query: Record<string, unknown> = {};
    if (action) query.action = { $regex: action, $options: 'i' };
    if (targetType) query.targetType = targetType;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('adminId', 'email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);
    res.json({
      logs: logs.map((l) => ({
        id: l._id,
        adminId: l.adminId,
        adminEmail: (l.adminId as { email?: string })?.email ?? null,
        action: l.action,
        targetType: l.targetType,
        targetId: l.targetId,
        metadata: l.metadata,
        createdAt: l.createdAt,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
