'use strict';
/**
 * Express application. Route modules own HTTP. Rules stay in engines/.
 * The service key never leaves this process.
 */
const express = require('express');
const sentry = require('./lib/sentry');
const verification = require('./verification');
const { supaFetch } = require('./http/supabase');
const { sendError } = require('./http/respond');
const { serveStatic } = require('./http/static');
const { gateRequests } = require('./middleware/protect');
const systemRoutes = require('./routes/system');
const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/account');
const listingRoutes = require('./routes/listings');
const bookingRoutes = require('./routes/bookings');
const socialRoutes = require('./routes/social');
const verificationRoutes = require('./routes/verification');
const protectionRoutes = require('./routes/protection');

verification.bindFetch((pathname, opts) => supaFetch(pathname, opts));

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use(gateRequests);
  app.use('/api', systemRoutes);
  app.use('/api', authRoutes);
  app.use('/api', accountRoutes);
  app.use('/api', protectionRoutes);
  app.use('/api', listingRoutes);
  app.use('/api', bookingRoutes);
  app.use('/api', socialRoutes);
  app.use('/api', verificationRoutes);
  app.use('/api', (req, res) => sendError(res, 404, 'NOT_FOUND', 'Unknown endpoint.'));
  app.use((req, res) => serveStatic(req, res, req.path));
  app.use((err, req, res, next) => {
    sentry.capture(err && err.message ? err.message : 'request failed', { path: req.originalUrl || req.url });
    if (!res.headersSent) sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong.');
  });
  return app;
}

module.exports = { createApp };
