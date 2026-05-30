// =========================================================================
// Marsexpress24 — REST API client (Mini App side)
// File: miniapp/js/api.js
//
// Exposes a global `window.api` with one method per endpoint.
// Every request carries the Telegram initData in the
// `X-Telegram-Init-Data` header — the bot middleware validates it.
//
// Configure the base URL by setting `window.API_BASE` BEFORE this script
// loads (e.g. via an inline <script> in index.html). Defaults to "/api"
// when the Mini App is served from the same origin as the bot.
// =========================================================================

(function () {
    'use strict';

    const API_BASE = (window.API_BASE || '/api').replace(/\/$/, '');

    function initData() {
        // Telegram.WebApp.initData is the raw query-string form (the one
        // the bot validates). Falls back to "" outside Telegram (dev).
        return (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) || '';
    }

    async function request(path, { method = 'GET', body, signal } = {}) {
        const url = `${API_BASE}${path}`;
        const headers = {
            'Accept': 'application/json',
            'X-Telegram-Init-Data': initData(),
            // ngrok's free tier serves a browser interstitial unless this
            // header is present — without it our fetch gets an HTML page
            // instead of the actual JSON response.
            // https://ngrok.com/docs/guides/other-guides/abuse-protection/#browser-warning
            'ngrok-skip-browser-warning': '1',
        };
        if (body !== undefined) {
            headers['Content-Type'] = 'application/json';
        }

        let response;
        try {
            response = await fetch(url, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
                signal,
                credentials: 'omit',
            });
        } catch (err) {
            // Network failure / CORS rejection / aborted
            const e = new Error('Tarmoq xatosi. Internetni tekshiring.');
            e.cause = err;
            e.kind = 'network';
            throw e;
        }

        const ct = response.headers.get('content-type') || '';
        const isJson = ct.includes('application/json');

        let data = null;
        if (isJson) {
            try {
                data = await response.json();
            } catch {
                /* allow empty body */
            }
        }

        if (!response.ok) {
            const msg = (data && data.error) || `HTTP ${response.status}`;
            const e = new Error(msg);
            e.status = response.status;
            e.reason = data && data.reason;
            e.kind = 'http';
            throw e;
        }

        // 2xx response but body wasn't JSON — almost always means an
        // intermediary (ngrok interstitial, captive portal, proxy error
        // page) returned HTML. Surface it instead of silently returning null.
        if (!isJson) {
            const sample = (await response.text().catch(() => '')).slice(0, 80);
            const e = new Error(`Server JSON o'rniga ${ct || 'noma\'lum tur'} qaytardi`);
            e.kind = 'bad_response';
            e.sample = sample;
            throw e;
        }

        return data;
    }

    window.api = {
        /** @returns {Promise<{ categories: Array }>} */
        getCategories() {
            return request('/categories');
        },

        /**
         * @param {number} [categoryId]
         * @returns {Promise<{ products: Array }>}
         */
        getProducts(categoryId) {
            const qs = categoryId ? `?category_id=${encodeURIComponent(categoryId)}` : '';
            return request(`/products${qs}`);
        },

        /** @returns {Promise<{ product: object }>} */
        getProduct(id) {
            return request(`/products/${encodeURIComponent(id)}`);
        },

        /**
         * Current user's orders. Prefer the server's verified identity
         * (from signed initData); but some Telegram clients don't deliver
         * signed initData, so we also pass the unsigned user id from
         * initDataUnsafe as a fallback. The server uses the verified id
         * when present and only falls back to this otherwise.
         */
        getOrders() {
            // Identity, in priority order:
            //   1) ?uid=  injected into the Mini App URL by the bot's
            //      /start button (reliable — the bot knows ctx.from.id).
            //   2) initDataUnsafe.user.id (when Telegram delivers it).
            let uid = '';
            try {
                uid = new URLSearchParams(window.location.search).get('uid') || '';
            } catch {}
            if (!uid) {
                const u =
                    window.Telegram &&
                    window.Telegram.WebApp &&
                    window.Telegram.WebApp.initDataUnsafe &&
                    window.Telegram.WebApp.initDataUnsafe.user;
                if (u && u.id) uid = String(u.id);
            }
            return request('/orders' + (uid ? `?uid=${encodeURIComponent(uid)}` : ''));
        },

        /**
         * The user's saved UI language ('uz' | 'ru'). Identified by the uid
         * the bot injects into the Mini App URL (?uid=), exactly like
         * getOrders/createOrder. No auth needed — this drives which language
         * the whole UI boots in, so it must resolve before first render.
         */
        getUserLang() {
            let uid = '';
            try {
                uid = new URLSearchParams(window.location.search).get('uid') || '';
            } catch {}
            if (!uid) {
                const u =
                    window.Telegram &&
                    window.Telegram.WebApp &&
                    window.Telegram.WebApp.initDataUnsafe &&
                    window.Telegram.WebApp.initDataUnsafe.user;
                if (u && u.id) uid = String(u.id);
            }
            return request('/user-lang' + (uid ? `?uid=${encodeURIComponent(uid)}` : ''));
        },

        /** Open/closed flag — server-side check anchored to Asia/Tashkent. */
        getStatus() {
            return request('/status');
        },

        /** Restaurant geo + delivery pricing constants. */
        getRestaurant() {
            return request('/restaurant');
        },

        /** Forward-geocode a free-form address via the server's Nominatim proxy. */
        geocode(address) {
            return request('/geocode', { method: 'POST', body: { address } });
        },

        /**
         * Submit an order. Inline-keyboard Mini Apps can't use sendData(),
         * so we POST here. The customer's telegram id (uid) is taken from
         * the Mini App URL (?uid=) injected by the bot's /start button.
         */
        createOrder(payload) {
            let uid = '';
            try {
                uid = new URLSearchParams(window.location.search).get('uid') || '';
            } catch {}
            if (!uid) {
                const u =
                    window.Telegram &&
                    window.Telegram.WebApp &&
                    window.Telegram.WebApp.initDataUnsafe &&
                    window.Telegram.WebApp.initDataUnsafe.user;
                if (u && u.id) uid = String(u.id);
            }
            return request('/orders', { method: 'POST', body: { ...payload, uid } });
        },
    };
})();
