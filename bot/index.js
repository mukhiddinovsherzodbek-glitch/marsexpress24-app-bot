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
// Cache the welcome photo's file_id after the first send. Telegram lets us
// re-reference an already-uploaded file by id, which skips the multi-MB
// re-upload on every /start and makes the photo arrive almost instantly.
let cachedWelcomePhotoId = null;

bot.start(async (ctx) => {
    // Outside working hours we don't show the order button — replying
    // with a closed notice avoids inviting an order we can't fulfil.
    if (!isWorkingHours()) {
        await ctx.reply(
            'Uzr, hozir ishlamayapmiz.\n' +
            `Ish vaqtimiz: ${WORKING_HOURS_LABEL} (Toshkent vaqti)\n` +
            'Tez orada xizmatda bo\'lamiz!'
        );
        return;
    }

    const greetingText =
        'Assalomu alaykum! Marsexpress24 ga xush kelibsiz 🍔\n' +
        'Buyurtma berish uchun quyidagi tugmani bosing:';
    const greetingMarkup = WEBAPP_URL
        ? Markup.keyboard([
              Markup.button.webApp('🛍️ Buyurtma berish', WEBAPP_URL),
          ]).resize()
        : undefined;

    // 1) Welcome image — re-use cached file_id when we have it (instant),
    //    otherwise upload from disk and cache the returned id.
    const photoPath = path.join(__dirname, 'assets', 'welcome_start.png');
    const haveFile = fs.existsSync(photoPath);

    if (cachedWelcomePhotoId) {
        try {
            await ctx.replyWithPhoto(cachedWelcomePhotoId);
        } catch (err) {
            console.warn('[/start] cached file_id rejected, re-uploading:', err.message);
            cachedWelcomePhotoId = null;
        }
    }

    if (!cachedWelcomePhotoId && haveFile) {
        // Show "uploading photo…" indicator so the user sees we're working.
        ctx.sendChatAction('upload_photo').catch(() => {});
        try {
            const msg = await ctx.replyWithPhoto({ source: photoPath });
            // Telegram returns an array of sizes — the largest is last.
            const sizes = msg && msg.photo;
            if (Array.isArray(sizes) && sizes.length > 0) {
                cachedWelcomePhotoId = sizes[sizes.length - 1].file_id;
            }
        } catch (err) {
            console.error('[/start] failed to send photo:', err.message);
        }
    } else if (!cachedWelcomePhotoId && !haveFile) {
        console.warn(`[/start] welcome image missing: ${photoPath}`);
    }

    // 2) Greeting + reply-keyboard button that opens the Mini App.
    //    NOTE: Telegram.WebApp.sendData() only fires when the app is
    //    opened from a *reply* keyboard button (KeyboardButton.web_app).
    //    Inline-keyboard web-app buttons can't post back via web_app_data,
    //    so we deliberately use a reply keyboard here.
    await ctx.reply(greetingText, greetingMarkup);
});

// --- web_app_data: order received from Mini App --------------------------
bot.on(message('web_app_data'), async (ctx) => {
    const raw = ctx.message.web_app_data.data;

    let order;
    try {
        order = JSON.parse(raw);
    } catch {
        await ctx.reply('⚠️ Buyurtma ma\'lumotlari yaroqsiz formatda.');
        return;
    }

    const validationError = validateOrder(order);
    if (validationError) {
        await ctx.reply(`⚠️ ${validationError}`);
        return;
    }

    // Guard against orders sent outside working hours — the Mini App also
    // checks, but a stale tab or replayed payload could still hit us.
    if (!isWorkingHours()) {
        await ctx.reply(
            'Uzr, hozir qabul vaqtimiz tugagan.\n' +
            `Ish vaqtimiz: ${WORKING_HOURS_LABEL} (Toshkent vaqti)`
        );
        return;
    }

    const {
        customer_name,
        customer_phone,
        latitude = null,
        longitude = null,
        address_text,
        items,
        total_amount,
        comment = null,
    } = order;

    // Normalise optional comment — trim, cap length, drop if empty.
    const orderComment =
        typeof comment === 'string' && comment.trim() ? comment.trim().slice(0, 500) : null;

    // Re-derive subtotal from items so we never trust the client's number
    // for the minimum-order check or the delivered-to-admin total.
    const subtotal = items.reduce(
        (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0),
        0
    );
    if (subtotal < MIN_ORDER_TOTAL) {
        await ctx.reply(
            `⚠️ Minimal buyurtma summasi: ${formatPrice(MIN_ORDER_TOTAL)} so'm.\n` +
            `Sizning savatingiz: ${formatPrice(subtotal)} so'm.`
        );
        return;
    }

    // Re-derive distance + delivery fee on the server. If the client
    // sent coordinates we use them; otherwise delivery is unknown and
    // will be settled by phone (we still accept the order).
    let distanceKm = null;
    let deliveryFee = 0;
    let deliveryUnknown = false;
    if (latitude != null && longitude != null) {
        distanceKm = haversineKm(
            RESTAURANT_LAT, RESTAURANT_LON,
            Number(latitude), Number(longitude)
        );
        deliveryFee = deliveryFeeFor(distanceKm);
    } else {
        // No coords — admin will quote delivery on the phone.
        deliveryUnknown = true;
    }
    // Authoritative grand total. The client's `total_amount` is informational.
    const grandTotal = subtotal + deliveryFee;

    // Save and respond.
    let orderId;
    let createdAt;
    try {
        const { rows } = await db.query(
            `INSERT INTO orders
                (telegram_user_id, customer_name, customer_phone,
                 latitude, longitude, address_text, items, total_amount)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
             RETURNING id, created_at`,
            [
                ctx.from.id,
                customer_name,
                customer_phone,
                latitude,
                longitude,
                address_text,
                JSON.stringify(items),
                grandTotal, // includes delivery fee
            ]
        );
        orderId = rows[0].id;
        createdAt = rows[0].created_at;
    } catch (err) {
        console.error('[web_app_data] DB insert failed:', err);
        await ctx.reply('⚠️ Buyurtmani saqlashda xato yuz berdi. Iltimos, qayta urinib ko\'ring.');
        return;
    }

    // Customer confirmation.
    await ctx.reply(
        '✅ Buyurtmangiz muvaffaqiyatli qabul qilindi!\n' +
        '🍔 Tez orada kuryer siz bilan bog\'lanadi.\n' +
        'Rahmat! Marsexpress24 🧡',
        // Hide the reply keyboard after the order — feels cleaner.
        Markup.removeKeyboard()
    );

    // If a location was sent with the order, echo it back to the customer
    // as a real Telegram location pin. The customer can tap it to open
    // Yandex / Google / Apple Maps and verify it's correct.
    if (latitude != null && longitude != null) {
        try {
            await ctx.replyWithLocation(Number(latitude), Number(longitude));
        } catch (err) {
            console.error('[web_app_data] customer location failed:', err.message);
        }
    }

    // Admin receipt (best-effort — must not block customer reply).
    if (ADMIN_ID) {
        const receipt = formatAdminReceipt({
            orderId,
            createdAt,
            customer_name,
            customer_phone,
            latitude,
            longitude,
            address_text,
            items,
            subtotal,
            distanceKm,
            deliveryFee,
            deliveryUnknown,
            comment: orderComment,
            total_amount: grandTotal,
        });
        try {
            await ctx.telegram.sendMessage(ADMIN_ID, receipt);
        } catch (err) {
            console.error('[web_app_data] admin notify failed:', err.message);
        }
        // Pin the location on the admin's map too — courier can tap it.
        if (latitude != null && longitude != null) {
            try {
                await ctx.telegram.sendLocation(
                    ADMIN_ID,
                    Number(latitude),
                    Number(longitude)
                );
            } catch (err) {
                console.error('[web_app_data] admin location failed:', err.message);
            }
        }
    }
});

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
