import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { errorHandler } from './middlewares/errorHandler';
import authRoutes from './routes/auth';
import filesRoutes from './routes/files';
import foldersRoutes from './routes/folders';
import sharesRoutes from './routes/shares';
import fileRequestsRoutes from './routes/fileRequests';
import billingRoutes from './routes/billing';
import apiKeysRoutes from './routes/apiKeys';
import apiV1Routes from './routes/api';
import adminRoutes from './routes/admin';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));

app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  })
);

app.use(express.json({ verify: (req, _res, buf) => { (req as { rawBody?: Buffer }).rawBody = buf; } }));

app.use(
  rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

import swaggerUi from 'swagger-ui-express';
import { swaggerDocument } from './swagger';

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/folders', foldersRoutes);
app.use('/api/shares', sharesRoutes);
app.use('/api/file-requests', fileRequestsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/api-keys', apiKeysRoutes);
app.use('/api/v1', apiV1Routes);
app.use('/api/admin', adminRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Serve frontend static files (for Heroku single-app deployment)
const frontendOut = path.join(__dirname, '../../frontend/out');
try {
  if (fs.existsSync(frontendOut)) {
    app.use(express.static(frontendOut));
    // Fallback for dynamic share/request routes - serve the static HTML shell
    app.get('/share/:token', (_req, res) => {
      res.sendFile(path.join(frontendOut, 'share/default/index.html'));
    });
    app.get('/share/:token/', (_req, res) => {
      res.sendFile(path.join(frontendOut, 'share/default/index.html'));
    });
    app.get('/request/:token', (_req, res) => {
      res.sendFile(path.join(frontendOut, 'request/default/index.html'));
    });
    app.get('/request/:token/', (_req, res) => {
      res.sendFile(path.join(frontendOut, 'request/default/index.html'));
    });
    // SPA fallback - serve index.html for other frontend routes
    app.get('*', (req, res, next) => {
      if (!req.path.startsWith('/api') && !req.path.startsWith('/api-docs') && req.path !== '/health') {
        const file = path.join(frontendOut, req.path, 'index.html');
        if (fs.existsSync(file)) {
          return res.sendFile(file);
        }
        return res.sendFile(path.join(frontendOut, 'index.html'));
      }
      next();
    });
  }
} catch {
  // frontend/out not built - API-only mode
}

// 404 for API routes that weren't matched
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'Not found' });
  }
  next();
});

app.use(errorHandler);

export default app;
