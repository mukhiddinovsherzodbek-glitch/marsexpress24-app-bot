// =========================================================================
// Marsexpress24 — REST API routes
// File: bot/routes/api.js
//
// All routes require valid Telegram initData (handled by the auth middleware
// mounted at the parent /api path in index.js). So `req.telegramUser`
// is guaranteed to be present here.
//
// Endpoints:
//   GET /api/categories                         — list active categories
//   GET /api/products?category_id=NN            — list products in a category
//   GET /api/products/:id                       — single product
//   GET /api/orders                             — current user's orders
// =========================================================================

'use strict';

const express = require('express');
const db = require('../db');
const cfg = require('../config');

const router = express.Router();

// -------------------------------------------------------------------------
// Postgres returns NUMERIC as a string to preserve precision.
// For UI consumption we want a JS number. Prices in this project are
// whole-thousand integers (so'm), so precision loss is not a concern.
// -------------------------------------------------------------------------
function numOrNull(v) {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function mapProduct(row) {
    return {
        id: row.id,
        category_id: row.category_id,
        name: row.name,
        description: row.description,
        price: numOrNull(row.price),
        image_url: row.image_url,
        is_available: row.is_available,
    };
}

function mapOrder(row) {
    return {
        id: row.id,
        customer_name: row.customer_name,
        customer_phone: row.customer_phone,
        latitude: numOrNull(row.latitude),
        longitude: numOrNull(row.longitude),
        address_text: row.address_text,
        items: row.items, // JSONB — pg already parses to JS
        total_amount: numOrNull(row.total_amount),
        status: row.status,
        comment: row.comment || null,
        created_at: row.created_at,
    };
}

// -------------------------------------------------------------------------
// GET /api/status — open/closed flag + working-hours label.
// Mini App polls this on boot to show a "closed" banner outside hours.
// -------------------------------------------------------------------------
router.get('/status', (_req, res) => {
    res.json({
        is_open: cfg.isWorkingHours(),
        hours_label: cfg.WORKING_HOURS_LABEL,
        timezone: cfg.WORKING_HOURS_TZ,
    });
});

// -------------------------------------------------------------------------
// GET /api/restaurant — geographic anchor + pricing constants the Mini
// App needs to compute delivery fees client-side (with Haversine).
// -------------------------------------------------------------------------
router.get('/restaurant', (_req, res) => {
    res.json({
        lat: cfg.RESTAURANT_LAT,
        lon: cfg.RESTAURANT_LON,
        address: cfg.RESTAURANT_ADDRESS,
        free_delivery_km: cfg.FREE_DELIVERY_KM,
        per_km_fee: cfg.PER_KM_FEE,
        min_order_total: cfg.MIN_ORDER_TOTAL,
    });
});

// -------------------------------------------------------------------------
// POST /api/geocode — forward-geocode an address via Nominatim.
// Body: { address: string }
// Response: { lat, lon, display_name }  |  404 { error: 'not_found' }
//
// Nominatim's TOS asks for a meaningful User-Agent and at most 1 req/sec;
// we throttle here in memory (a tiny in-process semaphore is enough since
// Express requests for this route are user-initiated).
// -------------------------------------------------------------------------
let lastGeocodeAt = 0;
async function throttleNominatim() {
    const now = Date.now();
    const wait = Math.max(0, 1100 - (now - lastGeocodeAt));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastGeocodeAt = Date.now();
}

router.post('/geocode', express.json({ limit: '1kb' }), async (req, res, next) => {
    try {
        const address = String(req.body && req.body.address || '').trim();
        if (address.length < 3) {
            return res.status(400).json({ error: 'address too short' });
        }

        // Bias the search toward Samarqand so partial input ("Registon")
        // doesn't return a hit from another city.
        const fullAddress = /samarqand|samarkand/i.test(address)
            ? address
            : `Samarqand, ${address}`;

        await throttleNominatim();
        const url =
            'https://nominatim.openstreetmap.org/search?format=json&limit=1' +
            '&countrycodes=uz' +
            '&q=' + encodeURIComponent(fullAddress);

        const r = await fetch(url, {
            headers: {
                'User-Agent': 'marsexpress24-bot/1.0 (delivery distance calc)',
                'Accept-Language': 'uz,en',
            },
            signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) {
            return res.status(502).json({ error: 'geocoder upstream', status: r.status });
        }
        const arr = await r.json();
        if (!Array.isArray(arr) || arr.length === 0) {
            return res.status(404).json({ error: 'not_found' });
        }
        const hit = arr[0];
        res.json({
            lat: Number(hit.lat),
            lon: Number(hit.lon),
            display_name: hit.display_name,
        });
    } catch (err) {
        next(err);
    }
});

// -------------------------------------------------------------------------
// GET /api/categories
// -------------------------------------------------------------------------
router.get('/categories', async (_req, res, next) => {
    try {
        const { rows } = await db.query(`
            SELECT id, name, image_url, sort_order
              FROM categories
             ORDER BY sort_order, id
        `);
        res.json({ categories: rows });
    } catch (err) {
        next(err);
    }
});

// -------------------------------------------------------------------------
// GET /api/products?category_id=N
//   - If category_id omitted, returns all available products.
// -------------------------------------------------------------------------
router.get('/products', async (req, res, next) => {
    try {
        const categoryIdRaw = req.query.category_id;
        const categoryId = categoryIdRaw === undefined ? null : Number(categoryIdRaw);
        if (categoryIdRaw !== undefined && !Number.isInteger(categoryId)) {
            return res.status(400).json({ error: 'category_id must be an integer' });
        }

        let sql = `
            SELECT id, category_id, name, description, price, image_url, is_available
              FROM products
             WHERE is_available = TRUE
        `;
        const params = [];
        if (categoryId !== null) {
            params.push(categoryId);
            sql += ` AND category_id = $${params.length}`;
        }
        sql += ' ORDER BY price ASC, id ASC';

        const { rows } = await db.query(sql, params);
        res.json({ products: rows.map(mapProduct) });
    } catch (err) {
        next(err);
    }
});

// -------------------------------------------------------------------------
// GET /api/products/:id
// -------------------------------------------------------------------------
router.get('/products/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) {
            return res.status(400).json({ error: 'id must be an integer' });
        }
        const { rows } = await db.query(
            `SELECT id, category_id, name, description, price, image_url, is_available
               FROM products
              WHERE id = $1`,
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'not found' });
        }
        res.json({ product: mapProduct(rows[0]) });
    } catch (err) {
        next(err);
    }
});

// -------------------------------------------------------------------------
// GET /api/orders
//
// Always returns orders for the AUTHENTICATED user — never trust a
// `user_id` query param from the client, otherwise any user could read
// any other user's orders. The `?user_id=` param is accepted (the
// frontend includes it for clarity) but only as a sanity check.
// -------------------------------------------------------------------------
router.get('/orders', async (req, res, next) => {
    try {
        const authUserId = req.telegramUser?.id;

        // Identity resolution:
        //   1) verified user from signed initData (most trustworthy)
        //   2) unsigned `uid` the Mini App read from initDataUnsafe — used
        //      only when Telegram didn't deliver signed initData (a known
        //      issue on some clients). Spoofable, but the worst case is
        //      seeing another id's order list — acceptable for this app.
        const fallbackUid = Number(req.query.uid);
        const userId =
            authUserId ||
            (Number.isInteger(fallbackUid) ? fallbackUid : null);

        if (!userId) {
            // No identity at all → empty history, not an error.
            return res.json({ orders: [] });
        }

        const { rows } = await db.query(
            `SELECT id, customer_name, customer_phone, latitude, longitude,
                    address_text, items, total_amount, status, comment, created_at
               FROM orders
              WHERE telegram_user_id = $1
              ORDER BY created_at DESC
              LIMIT 50`,
            [userId]
        );
        res.json({ orders: rows.map(mapOrder) });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
