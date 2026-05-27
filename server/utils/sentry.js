/**
 * sentry.js — Error tracking + observability (D-01 audit Mariana 2026-05-27).
 *
 * Si SENTRY_DSN está en env vars, inicializa @sentry/node con sampling
 * conservador y captura automática de uncaught exceptions / unhandled
 * promise rejections + Express request handler/error handler.
 *
 * Si SENTRY_DSN NO está, exporta no-op stubs para que el código consumer
 * no necesite checks.
 *
 * Operador: configurar SENTRY_DSN en Railway env vars cuando esté listo.
 * Mientras tanto, todo loguea normalmente a stdout (Railway logs).
 */
'use strict';

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const SENTRY_RELEASE = process.env.SENTRY_RELEASE || process.env.GIT_SHA;

let Sentry = null;
let enabled = false;

if (SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: SENTRY_ENVIRONMENT,
      release: SENTRY_RELEASE,
      tracesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0,
      // PII redaction (RGPD Art. 5(1)(c) minimización + D-02 audit Mariana):
      // sendDefaultPii=false evita que Sentry inyecte automatically headers,
      // cookies o user IPs. Solo capturamos lo que añadimos manualmente.
      sendDefaultPii: false,
      beforeSend(event) {
        // Sanea email/JWT/password de cualquier string en breadcrumbs/exceptions
        try {
          const json = JSON.stringify(event);
          const sanitized = json
            .replace(/[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<redacted-email>')
            .replace(/Bearer\s+[A-Za-z0-9._\-+/=]{20,}/g, 'Bearer <redacted-token>')
            .replace(/"password"\s*:\s*"[^"]*"/g, '"password":"<redacted>"');
          return JSON.parse(sanitized);
        } catch (_) {
          return event;
        }
      },
    });
    enabled = true;
    console.log(`[sentry] enabled — env=${SENTRY_ENVIRONMENT} release=${SENTRY_RELEASE ?? 'unset'}`);
  } catch (err) {
    console.error('[sentry] init failed:', err.message);
    Sentry = null;
    enabled = false;
  }
} else {
  // No-op stubs — code consumer no necesita check
  Sentry = {
    captureException: () => {},
    captureMessage: () => {},
    setUser: () => {},
    setContext: () => {},
    setTag: () => {},
    addBreadcrumb: () => {},
    Handlers: {
      requestHandler: () => (_req, _res, next) => next(),
      errorHandler: () => (err, _req, _res, next) => next(err),
    },
  };
}

module.exports = { Sentry, enabled };
