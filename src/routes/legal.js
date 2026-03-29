const express = require('express');
const router = express.Router();
const { LOG_RETENTION_DAYS } = require('../logger');

// GET /legal/terms — Terms of Use
router.get('/terms', (req, res) => {
  res.render('legal/terms', {
    pageTitle: res.locals.lang === 'en' ? 'Terms of Use' : 'Felhasználási feltételek',
    currentPath: '/legal/terms',
    logRetentionDays: LOG_RETENTION_DAYS
  });
});

// GET /legal/privacy — Privacy Policy / GDPR
router.get('/privacy', (req, res) => {
  res.render('legal/privacy', {
    pageTitle: res.locals.lang === 'en' ? 'Privacy Policy' : 'Adatvédelmi szabályzat',
    currentPath: '/legal/privacy',
    logRetentionDays: LOG_RETENTION_DAYS
  });
});

// GET /legal/cookies — Cookie Policy
router.get('/cookies', (req, res) => {
  res.render('legal/cookies', {
    pageTitle: res.locals.lang === 'en' ? 'Cookie Policy' : 'Cookie szabályzat',
    currentPath: '/legal/cookies',
    logRetentionDays: LOG_RETENTION_DAYS
  });
});

// POST /legal/cookie-consent — Accept cookie consent (sets cookie)
router.post('/cookie-consent', (req, res) => {
  // Set a long-lived cookie (1 year) for consent
  res.cookie('cookie_consent', 'accepted', {
    maxAge: 365 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
  // Redirect back to the page they were on, or home
  const redirectTo = req.body.redirect || req.headers.referer || '/';
  res.redirect(redirectTo);
});

module.exports = router;
