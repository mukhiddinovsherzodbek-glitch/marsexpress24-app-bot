// =========================================================================
// Marsexpress24 — cart state
// File: miniapp/js/cart.js
//
// Single source of truth for the shopping cart.
//
// Persistence:
//   • Primary: Telegram.WebApp.CloudStorage (per-user, follows them to
//     other devices). Required by the spec — cart survives close/open.
//   • Fallback: localStorage (used outside Telegram, e.g. in dev).
//
// Item shape:  { product_id, name, price, image_url, quantity }
//
// Public API on window.cart:
//   init()                  — load from storage, returns Promise
//   subscribe(fn)           — register change listener, returns unsubscribe
//   getItems()              — current items array (copy)
//   getCount()              — total quantity across items (for nav badge)
//   getTotal()              — sum of price * quantity
//   has(id)                 — boolean
//   quantityOf(id)          — number (0 if absent)
//   add(product, qty=1)     — add / increment
//   inc(id), dec(id)        — convenience
//   setQuantity(id, qty)    — exact; 0 removes
//   remove(id)              — remove a single item
//   clear()                 — empty cart + storage (call after order success)
// =========================================================================

(function () {
    'use strict';

    const STORAGE_KEY = 'mx24_cart_v1';

    // -------------------------------------------------------------------
    // Storage adapter — CloudStorage (preferred) or localStorage
    // -------------------------------------------------------------------
    const tgCloud = (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage) || null;

    function storageGet(key) {
        return new Promise((resolve) => {
            if (tgCloud && typeof tgCloud.getItem === 'function') {
                tgCloud.getItem(key, (err, value) => {
                    if (err) {
                        console.warn('[cart] CloudStorage.getItem error:', err);
                        resolve(null);
                        return;
                    }
                    resolve(value || null);
                });
                return;
            }
            try {
                resolve(localStorage.getItem(key));
            } catch {
                resolve(null);
            }
        });
    }

    function storageSet(key, value) {
        return new Promise((resolve) => {
            if (tgCloud && typeof tgCloud.setItem === 'function') {
                tgCloud.setItem(key, value, (err) => {
                    if (err) console.warn('[cart] CloudStorage.setItem error:', err);
                    resolve();
                });
                return;
            }
            try {
                localStorage.setItem(key, value);
            } catch (err) {
                console.warn('[cart] localStorage.setItem error:', err);
            }
            resolve();
        });
    }

    function storageRemove(key) {
        return new Promise((resolve) => {
            if (tgCloud && typeof tgCloud.removeItem === 'function') {
                tgCloud.removeItem(key, (err) => {
                    if (err) console.warn('[cart] CloudStorage.removeItem error:', err);
                    resolve();
                });
                return;
            }
            try {
                localStorage.removeItem(key);
            } catch {}
            resolve();
        });
    }

    // -------------------------------------------------------------------
    // State + pub/sub
    // -------------------------------------------------------------------
    let items = [];
    const listeners = new Set();
    let saveTimer = null;

    function notify() {
        for (const fn of listeners) {
            try { fn(getSnapshot()); } catch (err) { console.error('[cart] listener error:', err); }
        }
    }

    function getSnapshot() {
        return {
            items: items.map((i) => ({ ...i })),
            count: getCount(),
            total: getTotal(),
        };
    }

    function getCount() {
        let n = 0;
        for (const it of items) n += it.quantity;
        return n;
    }

    function getTotal() {
        let sum = 0;
        for (const it of items) sum += Number(it.price) * Number(it.quantity);
        return sum;
    }

    // Save is debounced — rapid +/+/+ taps coalesce into one write.
    function scheduleSave() {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            saveTimer = null;
            const payload = JSON.stringify(items);
            // CloudStorage hard limit is 4096 bytes per key. ~30 items
            // fit comfortably. If we ever overflow, drop image_url to
            // halve the payload — render layer can fall back to product
            // cache lookup.
            if (payload.length > 4000) {
                const slim = JSON.stringify(items.map((i) => ({
                    product_id: i.product_id,
                    name: i.name,
                    price: i.price,
                    quantity: i.quantity,
                })));
                storageSet(STORAGE_KEY, slim);
            } else {
                storageSet(STORAGE_KEY, payload);
            }
        }, 200);
    }

    function mutate(fn) {
        fn();
        notify();
        scheduleSave();
    }

    // -------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------
    async function init() {
        const raw = await storageGet(STORAGE_KEY);
        if (!raw) {
            items = [];
            notify();
            return;
        }
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                items = parsed
                    .filter((it) => it && Number.isInteger(it.product_id) && Number.isFinite(it.price))
                    .map((it) => ({
                        product_id: it.product_id,
                        name: String(it.name || ''),
                        price: Number(it.price) || 0,
                        image_url: it.image_url || null,
                        quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
                    }));
            }
        } catch (err) {
            console.warn('[cart] failed to parse stored cart, starting empty', err);
            items = [];
        }
        notify();
    }

    function subscribe(fn) {
        listeners.add(fn);
        // Push current state immediately so the caller doesn't need
        // a separate "initial render" code path.
        try { fn(getSnapshot()); } catch (err) { console.error('[cart] listener init error:', err); }
        return () => listeners.delete(fn);
    }

    function getItems() {
        return items.map((i) => ({ ...i }));
    }

    function has(id) {
        return items.some((i) => i.product_id === id);
    }

    function quantityOf(id) {
        const it = items.find((i) => i.product_id === id);
        return it ? it.quantity : 0;
    }

    /**
     * Add a product to the cart (or increment its quantity).
     * @param {{ id:number, name:string, price:number, image_url?:string }} product
     * @param {number} [qty=1]
     */
    function add(product, qty = 1) {
        if (!product || !Number.isInteger(product.id)) {
            console.warn('[cart] add() called with invalid product:', product);
            return;
        }
        const n = Math.max(1, Math.floor(Number(qty) || 1));
        mutate(() => {
            const existing = items.find((i) => i.product_id === product.id);
            if (existing) {
                existing.quantity += n;
            } else {
                items.push({
                    product_id: product.id,
                    name: String(product.name || ''),
                    price: Number(product.price) || 0,
                    image_url: product.image_url || null,
                    quantity: n,
                });
            }
        });
    }

    function inc(id) {
        mutate(() => {
            const it = items.find((i) => i.product_id === id);
            if (it) it.quantity += 1;
        });
    }

    function dec(id) {
        mutate(() => {
            const idx = items.findIndex((i) => i.product_id === id);
            if (idx === -1) return;
            items[idx].quantity -= 1;
            if (items[idx].quantity <= 0) items.splice(idx, 1);
        });
    }

    function setQuantity(id, qty) {
        const n = Math.floor(Number(qty) || 0);
        mutate(() => {
            const idx = items.findIndex((i) => i.product_id === id);
            if (idx === -1) return;
            if (n <= 0) items.splice(idx, 1);
            else items[idx].quantity = n;
        });
    }

    function remove(id) {
        mutate(() => {
            const idx = items.findIndex((i) => i.product_id === id);
            if (idx !== -1) items.splice(idx, 1);
        });
    }

    async function clear() {
        items = [];
        notify();
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }
        await storageRemove(STORAGE_KEY);
    }

    window.cart = {
        init,
        subscribe,
        getItems,
        getCount,
        getTotal,
        has,
        quantityOf,
        add,
        inc,
        dec,
        setQuantity,
        remove,
        clear,
    };
})();
