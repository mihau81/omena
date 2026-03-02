import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
    debug: false,
    beforeSend(event) {
      // Strip sensitive fields from request bodies before sending to Sentry
      if (event.request?.data && typeof event.request.data === 'object') {
        const data = event.request.data as Record<string, unknown>;
        if ('password' in data) data.password = '[Filtered]';
        if ('currentPassword' in data) data.currentPassword = '[Filtered]';
        if ('newPassword' in data) data.newPassword = '[Filtered]';
      }
      return event;
    },
  });
}
