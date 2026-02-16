import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middlewares/auth';
import { APIKey, hashKey, generateKey } from '../models/APIKey';
import { BadRequestError } from '../utils/errors';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const keys = await APIKey.find({ userId }).select('name keyPrefix scopes rateLimit lastUsedAt createdAt').lean();
    res.json({
      keys: keys.map((k) => ({
        id: k._id,
        name: k.name,
        keyPrefix: k.keyPrefix + '...',
        scopes: k.scopes,
        rateLimit: k.rateLimit,
        lastUsedAt: k.lastUsedAt,
        createdAt: k.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { name, scopes } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new BadRequestError('name required');
    }

    const key = generateKey();
    const keyHash = hashKey(key);
    const keyPrefix = key.slice(0, 12);

    await APIKey.create({
      userId,
      name: name.trim(),
      keyHash,
      keyPrefix,
      scopes: Array.isArray(scopes) ? scopes : ['files:read', 'files:write'],
      rateLimit: 100,
    });

    const created = await APIKey.findOne({ keyHash }).lean();
    res.status(201).json({
      id: created?._id,
      name: name.trim(),
      key,
      keyPrefix: keyPrefix + '...',
      warning: 'Save this key. It will not be shown again.',
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const result = await APIKey.findOneAndDelete({ _id: id, userId });
    if (!result) throw new BadRequestError('API key not found');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
