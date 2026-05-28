// =========================================================================
// Marsexpress24 — Telegram initData validation middleware
// File: bot/middleware/auth.js
//
// Validates Telegram Web App `initData` per the official algorithm:
//   https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
//
//   secret_key = HMAC_SHA256(key = "WebAppData", message = bot_token)
//   data_check_string = sorted "key=value" pairs joined by "\n" (hash excluded)
//   expected_hash = HMAC_SHA256(key = secret_key, message = data_check_string)
//
// On success:  req.telegramUser  = { id, first_name, username, ... }
//              req.telegramAuthDate = Date
// On failure:  401 JSON response.
// =========================================================================

'use strict';

const crypto = require('node:crypto');

// Reject initData older than this — protects against replay of stolen strings.
const MAX_AGE_SECONDS = 24 * 60 * 60; // 24h

/**
 * Verify Telegram Web App initData.
 * @param {string} initData    raw query-string format from Telegram.WebApp.initData
 * @param {string} botToken    Bot token from @BotFather
 * @returns {{ valid: boolean, reason?: string, user?: object, authDate?: Date }}
 */
function verifyInitData(initData, botToken) {
    if (!initData || typeof initData !== 'string') {
        return { valid: false, reason: 'missing initData' };
    }
    if (!botToken) {
        return { valid: false, reason: 'server: BOT_TOKEN not configured' };
    }

    const params = new URLSearchParams(initData);
    const providedHash = params.get('hash');
    if (!providedHash) {
        return { valid: false, reason: 'hash field missing' };
    }
    params.delete('hash');

    // Build data_check_string: sort by key, join "k=v" with newline.
    const pairs = [];
    for (const [k, v] of params.entries()) {
        pairs.push(`${k}=${v}`);
    }
    pairs.sort();
    const dataCheckString = pairs.join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    // Constant-time comparison — guard against timing side-channels.
    const a = Buffer.from(expectedHash, 'hex');
    const b = Buffer.from(providedHash, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return { valid: false, reason: 'signature mismatch' };
    }

    // Freshness check.
    const authDateRaw = params.get('auth_date');
    const authDate = authDateRaw ? Number(authDateRaw) : NaN;
    if (!Number.isFinite(authDate)) {
        return { valid: false, reason: 'auth_date missing' };
    }
    const ageSec = Math.floor(Date.now() / 1000) - authDate;
    if (ageSec > MAX_AGE_SECONDS) {
        return { valid: false, reason: 'initData expired' };
    }

    // Parse user payload if present.
    let user;
    const userRaw = params.get('user');
    if (userRaw) {
        try {
            user = JSON.parse(userRaw);
        } catch {
            return { valid: false, reason: 'user payload not JSON' };
        }
    }

    return { valid: true, user, authDate: new Date(authDate * 1000) };
}

// Stand-in identity used when the dev bypass kicks in. Stable id so any
// orders / cart state recorded during dev belong to a single fake account.
const DEV_FAKE_USER = Object.freeze({
    id: 123456789,
    first_name: 'Test',
    username: 'testuser',
    is_dev_bypass: true,
});

let devBypassWarned = false;

/**
 * Express middleware that requires a valid initData on every request.
 * Looks for the payload in (in priority order):
 *   1. header  `X-Telegram-Init-Data`
 *   2. query   `?_auth=<initData>`
 *   3. body    `{ _auth: "<initData>" }`
 *
 * Development bypass:
 *   When NODE_ENV !== 'production', a missing/invalid initData does NOT
 *   reject the request. A fixed fake user (DEV_FAKE_USER) is attached
 *   instead. This lets the Mini App be exercised end-to-end from a
 *   plain browser or from Telegram clients that don't deliver
 *   `tgWebAppData` (some desktop/inline-button scenarios).
 *
 *   If a valid initData IS present in dev, the real user is still used —
 *   the bypass only fires when verification would have rejected.
 */
function requireTelegramAuth(req, res, next) {
    const initData =
        req.get('x-telegram-init-data') ||
        req.query._auth ||
        (req.body && req.body._auth);

    const result = verifyInitData(initData, process.env.BOT_TOKEN);

    if (result.valid) {
        req.telegramUser = result.user;
        req.telegramAuthDate = result.authDate;
        return next();
    }

    // Production: hard reject.
    if (process.env.NODE_ENV === 'production') {
        return res.status(401).json({ error: 'unauthorized', reason: result.reason });
    }

    // Development bypass: inject the fake test user and proceed.
    if (!devBypassWarned) {
        console.warn(
            '[auth] DEV BYPASS — accepting requests without valid initData; ' +
            `injecting test user id=${DEV_FAKE_USER.id}. ` +
            'This is disabled when NODE_ENV=production.'
        );
        devBypassWarned = true;
    }
    req.telegramUser = { ...DEV_FAKE_USER };
    req.telegramAuthDate = new Date();
    next();
}

module.exports = { verifyInitData, requireTelegramAuth, MAX_AGE_SECONDS, DEV_FAKE_USER };
