import * as Sentry from '@sentry/node';

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (dsn) {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
    });
  }
}

export { Sentry };
