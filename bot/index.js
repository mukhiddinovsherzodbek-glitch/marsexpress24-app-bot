// =========================================================================
// Marsexpress24 — main entry
// File: bot/index.js
//
// Components:
//   • Telegraf bot — /start handler, web_app_data → DB → admin notify
//   • Express server — REST API for the Mini App, /healthz
//   • Webhook (production) or long-polling (development) by NODE_ENV
// =========================================================================

'use strict';

require('dotenv').config();

const path = require('node:path');
const fs = require('node:fs');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Telegraf, Markup } = require('telegraf');
const { message } = require('telegraf/filters');

const db = require('./db');
const i18n = require('./i18n');
const apiRouter = require('./routes/api');
const { softTelegramAuth } = require('./middleware/auth');

// -------------------------------------------------------------------------
// Config
// -------------------------------------------------------------------------
const {
    BOT_TOKEN,
    ADMIN_ID,
    PORT = 3000,
    NODE_ENV = 'development',
    ALLOWED_ORIGINS = 'https://web.telegram.org,https://t.me',
} = process.env;

// On Render (free tier), the public URL is exposed as RENDER_EXTERNAL_URL,
// so we fall back to it when WEBHOOK_DOMAIN / WEBAPP_URL aren't set
// explicitly. This means a fresh Render deployment "just works" with the
// minimal env vars: BOT_TOKEN, ADMIN_ID, DATABASE_URL, NODE_ENV.
const renderUrl = process.env.RENDER_EXTERNAL_URL || '';
const WEBAPP_URL     = process.env.WEBAPP_URL     || renderUrl || '';
const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN || renderUrl || '';

if (!BOT_TOKEN) {
    throw new Error('BOT_TOKEN is required — see .env.example');
}
if (!WEBAPP_URL) {
    console.warn('[warn] WEBAPP_URL not set — /start button will not open the Mini App');
}
if (WEBAPP_URL && !/^https:\/\//i.test(WEBAPP_URL)) {
    console.warn('[warn] WEBAPP_URL must be HTTPS — Telegram will reject the button');
}

const IS_PROD = NODE_ENV === 'production';
const USE_WEBHOOK = IS_PROD && !!WEBHOOK_DOMAIN;

// Business rules — see bot/config.js for the single source of truth.
const {
    RESTAURANT_LAT,
    RESTAURANT_LON,
    MIN_ORDER_TOTAL,
    WORKING_HOURS_LABEL,
    isWorkingHours,
    haversineKm,
    deliveryFeeFor,
} = require('./config');

// -------------------------------------------------------------------------
// Telegraf bot
// -------------------------------------------------------------------------
const bot = new Telegraf(BOT_TOKEN);

bot.catch((err, ctx) => {
    console.error(`[bot] error for update ${ctx.update?.update_id}:`, err);
});

// --- /start --------------------------------------------------------------
// Telegram lets us re-reference an already-uploaded photo by its file_id,
// which skips the multi-MB re-upload on every /start (and survives Render
// restarts, unlike an in-memory cache). Prefer the env var; fall back to a
// known-good default captured for this bot; the code re-logs a fresh id if
// both are missing/invalid.
const WELCOME_PHOTO_FILE_ID =
    process.env.WELCOME_PHOTO_FILE_ID ||
    'AgACAgIAAxkDAAMjahg-u3qbjOn2sv0lerdvgEoIBAUAAuwaaxtGp8FIm0rvEdwXF8UBAAMCAAN5AAM7BA';

/** Build the Mini App URL with the user's id as a query param. */
function webAppUrlForUser(userId) {
    try {
        const u = new URL(WEBAPP_URL);
        u.searchParams.set('uid', String(userId));
        return u.toString();
    } catch {
        return WEBAPP_URL;
    }
}

// --- i18n: per-user language ---------------------------------------------
// Pick a translation, falling back to Uzbek for any missing key/lang.
function tr(lang, key) {
    const L = i18n[lang] ? lang : 'uz';
    return (i18n[L] && i18n[L][key]) || i18n.uz[key] || key;
}

/** The user's saved language, defaulting to 'uz' (also when not yet known). */
async function getUserLang(userId) {
    try {
        const res = await db.query(
            'SELECT language FROM users WHERE telegram_user_id = $1',
            [userId]
        );
        return (res.rows[0] && res.rows[0].language) || 'uz';
    } catch (err) {
        console.error('[i18n] getUserLang failed:', err.message);
        return 'uz';
    }
}

/** Whether we've already onboarded this user (row exists). */
async function userExists(userId) {
    try {
        const res = await db.query(
            'SELECT 1 FROM users WHERE telegram_user_id = $1',
            [userId]
        );
        return res.rowCount > 0;
    } catch (err) {
        console.error('[i18n] userExists failed:', err.message);
        return false;
    }
}

/** Upsert the user's language choice. Returns the normalized value. */
async function setUserLang(userId, lang) {
    const normalized = lang === 'ru' ? 'ru' : 'uz';
    await db.query(
        `INSERT INTO users (telegram_user_id, language)
         VALUES ($1, $2)
         ON CONFLICT (telegram_user_id)
         DO UPDATE SET language = EXCLUDED.language`,
        [userId, normalized]
    );
    return normalized;
}

// Two-button language picker — shared by /start (new users) and /til.
function languageKeyboard() {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback('🇺🇿 O\'zbekcha', 'lang:uz'),
            Markup.button.callback('🇷🇺 Русский', 'lang:ru'),
        ],
    ]);
}

// The Mini App "order" button, labelled in the given language.
function orderKeyboard(lang, userId) {
    if (!WEBAPP_URL) return undefined;
    return Markup.inlineKeyboard([
        [Markup.button.webApp(tr(lang, 'orderBtn'), webAppUrlForUser(userId))],
    ]);
}

// Bilingual prompt shown to a brand-new user (we don't know their language
// yet) and on /til.
const LANG_PROMPT =
    'Assalomu alaykum! Marsexpress24 ga xush kelibsiz 🇺🇿\n' +
    'Здравствуйте! Добро пожаловать в Marsexpress24 🇷🇺\n\n' +
    '🌍 Tilni tanlang / Выберите язык:';

/**
 * Send the welcome image — file_id fast-path first (instant, no upload),
 * disk fallback otherwise (and log the returned file_id so it can be
 * promoted into WELCOME_PHOTO_FILE_ID). Extracted so /start can always
 * send the photo before any text, in every branch.
 */
async function sendWelcomePhoto(ctx) {
    if (WELCOME_PHOTO_FILE_ID) {
        try {
            await ctx.replyWithPhoto(WELCOME_PHOTO_FILE_ID);
            return;
        } catch (err) {
            console.warn('[/start] file_id photo rejected, falling back to disk:', err.message);
        }
    }
    const photoPath = path.join(__dirname, 'assets', 'welcome_start.png');
    if (!fs.existsSync(photoPath)) {
        console.warn('[/start] welcome image missing on disk:', photoPath);
        return;
    }
    try {
        const msg = await ctx.replyWithPhoto({ source: photoPath });
        const sizes = msg && msg.photo;
        if (Array.isArray(sizes) && sizes.length > 0) {
            console.log(
                '[/start] welcome_start.png uploaded — file_id =',
                sizes[sizes.length - 1].file_id,
                '\n         (set this as WELCOME_PHOTO_FILE_ID env to skip re-uploads)'
            );
        }
    } catch (err) {
        console.error('[/start] disk photo send failed:', err.message);
    }
}

bot.start(async (ctx) => {
    // Very first: silently strip any leftover reply keyboard from older
    // (pre-inline) sessions — even when we're closed, so the stale button
    // never lingers on the phone. A zero-width space is the smallest valid
    // message body Telegram accepts.
    try {
        await ctx.reply('\u200B', { reply_markup: { remove_keyboard: true } });
    } catch (err) {
        console.warn('[/start] remove_keyboard failed:', err.message);
    }

    // Always send the welcome image first — in every branch below.
    await sendWelcomePhoto(ctx);

    const userId = ctx.from.id;
    const known = await userExists(userId);

    // Outside working hours we don't invite orders. Returning users get the
    // notice in their language; brand-new users (no saved language yet) see
    // it in both languages.
    if (!isWorkingHours()) {
        if (known) {
            await ctx.reply(tr(await getUserLang(userId), 'closedMsg'));
        } else {
            await ctx.reply(i18n.uz.closedMsg + '\n\n' + i18n.ru.closedMsg);
        }
        return;
    }

    if (!known) {
        // New user → choose a language first. The order button appears only
        // after they pick (handled by the lang:* action below).
        await ctx.reply(LANG_PROMPT, languageKeyboard());
        return;
    }

    // Returning user → welcome + order button straight away, in their language.
    const lang = await getUserLang(userId);
    await ctx.reply(tr(lang, 'welcome'), orderKeyboard(lang, userId));
});

// --- Language selection (from /start onboarding or /til) ------------------
// Saves the choice, confirms with a toast, then replaces the picker message
// with the welcome + order button in the chosen language (no photo re-send).
bot.action(/^lang:(uz|ru)$/, async (ctx) => {
    const lang = ctx.match[1] === 'ru' ? 'ru' : 'uz';
    const userId = ctx.from.id;
    try {
        await setUserLang(userId, lang);
    } catch (err) {
        console.error('[lang] save failed:', err.message);
    }
    try { await ctx.answerCbQuery(tr(lang, 'langChanged')); } catch {}
    try {
        await ctx.editMessageText(tr(lang, 'welcome'), orderKeyboard(lang, userId));
    } catch {
        // Picker message too old to edit (or had no text) — send a fresh one.
        try { await ctx.reply(tr(lang, 'welcome'), orderKeyboard(lang, userId)); } catch {}
    }
});

// --- /til (язык): re-open the language picker -----------------------------
bot.command(['til', 'язык'], async (ctx) => {
    await ctx.reply(LANG_PROMPT, languageKeyboard());
});

// -------------------------------------------------------------------------
// processOrder — shared order pipeline used by BOTH:
//   • the legacy web_app_data handler (reply-keyboard sendData), and
//   • the new POST /api/orders endpoint (inline-keyboard Mini App).
//
// Validates, re-derives totals/delivery server-side, persists, then
// notifies the customer (by their telegram id) and the admin. Returns
// a plain result object so each caller can respond appropriately.
//
// @param {object}  order     the order payload from the Mini App
// @param {number}  userId    the customer's telegram id (trusted source)
// @param {object}  telegram  bot.telegram instance for sending messages
// -------------------------------------------------------------------------
async function processOrder(order, userId, telegram) {
    const validationError = validateOrder(order);
    if (validationError) return { ok: false, error: validationError };

    if (!isWorkingHours()) {
        return {
            ok: false,
            error:
                'Uzr, hozir qabul vaqtimiz tugagan. ' +
                `Ish vaqtimiz: ${WORKING_HOURS_LABEL} (Toshkent vaqti)`,
        };
    }

    const {
        customer_name,
        customer_phone,
        latitude = null,
        longitude = null,
        address_text,
        items,
        comment = null,
    } = order;

    const orderComment =
        typeof comment === 'string' && comment.trim() ? comment.trim().slice(0, 500) : null;

    // Never trust the client's total — re-derive from item prices.
    const subtotal = items.reduce(
        (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0),
        0
    );
    if (subtotal < MIN_ORDER_TOTAL) {
        return {
            ok: false,
            error:
                `Minimal buyurtma summasi: ${formatPrice(MIN_ORDER_TOTAL)} so'm. ` +
                `Sizning savatingiz: ${formatPrice(subtotal)} so'm.`,
        };
    }

    // Delivery fee from coords (else settled by phone).
    let distanceKm = null;
    let deliveryFee = 0;
    let deliveryUnknown = false;
    if (latitude != null && longitude != null) {
        distanceKm = haversineKm(RESTAURANT_LAT, RESTAURANT_LON, Number(latitude), Number(longitude));
        deliveryFee = deliveryFeeFor(distanceKm);
    } else {
        deliveryUnknown = true;
    }
    const grandTotal = subtotal + deliveryFee;

    let orderId;
    let createdAt;
    try {
        const { rows } = await db.query(
            `INSERT INTO orders
                (telegram_user_id, customer_name, customer_phone,
                 latitude, longitude, address_text, items, total_amount, comment)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
             RETURNING id, created_at`,
            [
                userId,
                customer_name,
                customer_phone,
                latitude,
                longitude,
                address_text,
                JSON.stringify(items),
                grandTotal,
                orderComment,
            ]
        );
        orderId = rows[0].id;
        createdAt = rows[0].created_at;
    } catch (err) {
        console.error('[order] DB insert failed:', err);
        return { ok: false, error: 'Buyurtmani saqlashda xato yuz berdi. Iltimos, qayta urinib ko\'ring.' };
    }

    // Customer confirmation — message their chat directly (works whether
    // the order came via sendData or via the REST endpoint), in their language.
    try {
        const lang = await getUserLang(userId);
        await telegram.sendMessage(userId, tr(lang, 'orderSuccess'));
        if (latitude != null && longitude != null) {
            await telegram.sendLocation(userId, Number(latitude), Number(longitude)).catch(() => {});
        }
    } catch (err) {
        console.error('[order] customer notify failed:', err.message);
    }

    // Admin receipt + map pin (best-effort).
    if (ADMIN_ID) {
        const receipt = formatAdminReceipt({
            orderId, createdAt, customer_name, customer_phone,
            latitude, longitude, address_text, items, subtotal,
            distanceKm, deliveryFee, deliveryUnknown,
            comment: orderComment, total_amount: grandTotal,
        });
        try {
            await telegram.sendMessage(ADMIN_ID, receipt);
        } catch (err) {
            console.error('[order] admin notify failed:', err.message);
        }
        if (latitude != null && longitude != null) {
            try {
                await telegram.sendLocation(ADMIN_ID, Number(latitude), Number(longitude));
            } catch (err) {
                console.error('[order] admin location failed:', err.message);
            }
        }
    }

    return { ok: true, orderId, subtotal, deliveryFee, distanceKm, total_amount: grandTotal };
}

// --- web_app_data: legacy path (reply-keyboard sendData) -----------------
// Kept for backward compatibility. The active flow is now POST /api/orders
// (inline-keyboard Mini App can't use sendData).
bot.on(message('web_app_data'), async (ctx) => {
    let order;
    try {
        order = JSON.parse(ctx.message.web_app_data.data);
    } catch {
        await ctx.reply('⚠️ Buyurtma ma\'lumotlari yaroqsiz formatda.');
        return;
    }
    const result = await processOrder(order, ctx.from.id, ctx.telegram);
    if (!result.ok) await ctx.reply(`⚠️ ${result.error}`);
    // On success, processOrder already messaged the customer + admin.
});

// --- Admin panel (/admin, ADMIN_ID only) ---------------------------------
require('./handlers/admin').register(bot);

// -------------------------------------------------------------------------
// Order helpers
// -------------------------------------------------------------------------
function validateOrder(o) {
    if (!o || typeof o !== 'object') return 'Buyurtma noto\'g\'ri formatda.';
    if (!o.customer_name || typeof o.customer_name !== 'string') return 'Ism kiritilmagan.';
    if (!o.customer_phone || typeof o.customer_phone !== 'string') return 'Telefon raqami kiritilmagan.';
    if (!o.address_text || typeof o.address_text !== 'string') return 'Manzil kiritilmagan.';
    if (!Array.isArray(o.items) || o.items.length === 0) return 'Buyurtma bo\'sh — savatga mahsulot qo\'shing.';
    if (typeof o.total_amount !== 'number' || !isFinite(o.total_amount) || o.total_amount <= 0) {
        return 'Buyurtma summasi noto\'g\'ri.';
    }
    return null;
}

function formatPrice(n) {
    return Number(n).toLocaleString('en-US').replace(/,/g, ' ');
}

function formatDate(d) {
    return new Date(d).toLocaleString('uz-UZ', {
        timeZone: 'Asia/Tashkent',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatAdminReceipt(o) {
    const itemsLines = o.items
        .map((it) => {
            const qty = Number(it.quantity) || 1;
            const price = Number(it.price) || 0;
            return `• ${it.name} x${qty} — ${formatPrice(price * qty)} so'm`;
        })
        .join('\n');

    const coords =
        o.latitude != null && o.longitude != null
            ? `${o.latitude}, ${o.longitude}`
            : 'Yuborilmagan';

    // Delivery info line — depends on whether we computed it server-side.
    let deliveryLine;
    if (o.deliveryUnknown) {
        deliveryLine = '📍 Masofa: aniqlanmagan | Dostavka: telefonda kelishiladi';
    } else if (o.distanceKm != null) {
        const distStr = o.distanceKm.toFixed(1);
        const feeStr = o.deliveryFee > 0
            ? `${formatPrice(o.deliveryFee)} so'm`
            : 'Bepul';
        deliveryLine = `📍 Masofa: ${distStr} km | Dostavka: ${feeStr}`;
    } else {
        deliveryLine = '📍 Masofa: —';
    }

    const lines = [
        `🆕 YANGI BUYURTMA #${o.orderId}`,
        '━━━━━━━━━━━━━━━━',
        `👤 Mijoz: ${o.customer_name}`,
        `📞 Telefon: ${o.customer_phone}`,
        `📍 Manzil: ${o.address_text}`,
        `🗺️ Koordinatalar: ${coords}`,
        deliveryLine,
    ];

    // Optional customer comment — only shown when present.
    if (o.comment) {
        lines.push(`💬 Izoh: ${o.comment}`);
    }

    lines.push(
        '━━━━━━━━━━━━━━━━',
        '🛒 Buyurtma tarkibi:',
        itemsLines,
        '━━━━━━━━━━━━━━━━',
        `🧾 Mahsulotlar: ${formatPrice(o.subtotal)} so'm`,
        `🚚 Dostavka: ${o.deliveryUnknown
            ? 'telefonda'
            : o.deliveryFee > 0 ? formatPrice(o.deliveryFee) + " so'm" : 'Bepul'}`,
        `💰 JAMI: ${formatPrice(o.total_amount)} so'm`,
        `🕐 Vaqt: ${formatDate(o.createdAt)}`
    );

    return lines.join('\n');
}

// -------------------------------------------------------------------------
// Express
// -------------------------------------------------------------------------
const app = express();
app.set('trust proxy', 1); // needed for accurate rate limiting behind proxies

// Helmet's defaults set `Cross-Origin-Resource-Policy: same-origin`, which
// Telegram's Mini App WebView treats strictly enough to block our own
// static images (the request returns 200 + image/png, but the renderer
// refuses to display it). Loosen CORP and COOP so cross-context loads
// (Telegram WebView, embedded preview) can render assets. CSP stays off
// because we use inline event handlers in some pages.
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: '64kb' }));

const allowedOrigins = ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);

// Auto-allow the public Mini App URL we configured ourselves. Without this,
// fetches from the Mini App (loaded from WEBAPP_URL) get rejected when the
// browser sends an Origin header — which happens for any cross-origin
// preflight or when an iframe carries one. The check is widened to match
// any subdomain ending in the configured host, since ngrok's free domain
// stays stable but Telegram sometimes routes through *.t.me.
if (WEBAPP_URL) {
    try { allowedOrigins.push(new URL(WEBAPP_URL).origin); } catch {}
}
// In development, also allow local ngrok-style tunnels and localhost.
if (!IS_PROD) {
    allowedOrigins.push('http://localhost:8080', 'http://localhost:3000');
}

function isOriginAllowed(origin) {
    if (allowedOrigins.includes(origin)) return true;
    // Suffix match (matches subdomains: web.telegram.org allows k.web.telegram.org).
    return allowedOrigins.some((o) => {
        const host = o.replace(/^https?:\/\//, '');
        return origin.endsWith(host);
    });
}

app.use(
    cors({
        origin(origin, cb) {
            if (!origin) return cb(null, true); // direct calls (curl, server-side)
            if (isOriginAllowed(origin)) return cb(null, true);
            // Log every rejection so we can diagnose in production too.
            console.warn(`[cors] rejected origin: ${origin}`);
            cb(new Error(`CORS: origin not allowed: ${origin}`));
        },
        credentials: false,
    })
);

// 30 requests per minute per IP for the public API surface.
const apiLimiter = rateLimit({
    windowMs: 60_000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Tiny request logger for /api/* — surfaces every incoming call so we can
// see method, path, whether initData was attached, response status, and
// how long it took. Helps diagnose Mini App ↔ backend issues end-to-end.
app.use('/api', (req, res, next) => {
    const start = Date.now();
    const hasInit = !!(
        req.get('x-telegram-init-data') ||
        req.query._auth ||
        (req.body && req.body._auth)
    );
    const ua = (req.get('user-agent') || '').slice(0, 40);
    res.on('finish', () => {
        const ms = Date.now() - start;
        console.log(
            `[api] ${req.method} ${req.originalUrl} ` +
            `→ ${res.statusCode} ${ms}ms ` +
            `init=${hasInit ? 'YES' : 'no'} ua="${ua}" ip=${req.ip}`
        );
    });
    next();
});

// Diagnostic endpoint — accepts a small JSON snapshot from the Mini App
// describing why Telegram.WebApp.initData ended up empty. Mounted BEFORE
// requireTelegramAuth so it works without authentication. Logged to the
// server console; no DB write.
app.post('/api/_diag', express.json({ limit: '4kb' }), (req, res) => {
    console.log('[diag] from Mini App:', JSON.stringify(req.body));
    res.json({ ok: true });
});

// Order submission — the inline-keyboard Mini App can't use sendData(),
// so it POSTs the order here. The customer is identified by `uid` (their
// telegram id, injected into the Mini App URL by the /start button).
// Reads/writes are server-validated inside processOrder().
app.post('/api/orders', apiLimiter, express.json({ limit: '16kb' }), async (req, res) => {
    try {
        const body = req.body || {};
        const uid = Number(body.uid ?? body.user_id ?? req.query.uid);
        if (!Number.isInteger(uid) || uid <= 0) {
            return res.status(400).json({
                ok: false,
                error: 'Foydalanuvchi aniqlanmadi. Mini App ni bot tugmasi orqali oching.',
            });
        }
        const result = await processOrder(body, uid, bot.telegram);
        const logLine = `[api] POST /api/orders → ${result.ok ? 'ok #' + result.orderId : 'rejected'} uid=${uid}`;
        console.log(logLine);
        return res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
        console.error('[api] POST /api/orders failed:', err);
        return res.status(500).json({ ok: false, error: 'Server xatosi. Qayta urinib ko\'ring.' });
    }
});

// Soft auth (never rejects) attaches req.telegramUser when initData is
// valid. The catalog endpoints (categories/products/status/restaurant/
// geocode) are public menu data and work for everyone; the orders route
// uses req.telegramUser and returns an empty list when it's null.
app.use('/api', apiLimiter, softTelegramAuth, apiRouter);

// Serve the Mini App as static files from THIS server.
// Same-origin with /api → no CORS issues, single ngrok tunnel covers both.
// In dev we set maxAge=0 so changes are reloaded immediately; in production
// a 5-minute cache is fine because Telegram itself revalidates frequently.
app.use(express.static(path.join(__dirname, '..', 'miniapp'), {
    etag: true,
    maxAge: IS_PROD ? '5m' : 0,
    extensions: ['html'],
}));

// Webhook (production only) — must be registered BEFORE the error handler.
let webhookPath = null;
if (USE_WEBHOOK) {
    webhookPath = `/telegraf/${bot.secretPathComponent()}`;
    app.use(bot.webhookCallback(webhookPath));
}

// 404
app.use((_req, res) => res.status(404).json({ error: 'not found' }));

// Error handler — keep at the bottom.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('[express]', err);
    res.status(500).json({ error: 'internal' });
});

// -------------------------------------------------------------------------
// Boot
// -------------------------------------------------------------------------
const server = app.listen(PORT, async () => {
    console.log(`[server] listening on :${PORT}  (NODE_ENV=${NODE_ENV})`);

    if (USE_WEBHOOK) {
        const url = `${WEBHOOK_DOMAIN.replace(/\/$/, '')}${webhookPath}`;
        try {
            await bot.telegram.setWebhook(url);
            console.log('[bot] webhook set:', url);
        } catch (err) {
            console.error('[bot] setWebhook failed:', err.message);
        }
    } else {
        // Drop any leftover webhook from a previous deploy so polling can take over.
        await bot.telegram.deleteWebhook({ drop_pending_updates: false }).catch(() => {});

        // In Telegraf 4.x, bot.launch() in polling mode returns a Promise
        // that only resolves when the bot stops (via bot.stop()). So we
        // fire-and-forget here and log "started" right away. The Telegram
        // API call below confirms the connection is healthy.
        bot.launch().catch((err) => console.error('[bot] polling error:', err.message));

        try {
            const me = await bot.telegram.getMe();
            console.log(`[bot] polling started — @${me.username}`);
        } catch (err) {
            console.error('[bot] getMe failed (token invalid?):', err.message);
        }
    }
});

// -------------------------------------------------------------------------
// Graceful shutdown
// -------------------------------------------------------------------------
async function shutdown(signal) {
    console.log(`\n[shutdown] received ${signal}`);
    try {
        bot.stop(signal);
    } catch {}
    server.close(() => console.log('[shutdown] HTTP server closed'));
    try {
        await db.close();
        console.log('[shutdown] DB pool closed');
    } catch (err) {
        console.error('[shutdown] DB close error:', err.message);
    }
    process.exit(0);
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
