// =========================================================================
// Marsexpress24 — Mini App controller
// File: miniapp/js/app.js
//
// Glues everything together:
//   • Telegram WebApp lifecycle (ready/expand)
//   • Page routing  (bottom-nav: home ↔ orders)
//   • View routing  (within home: categories ↔ products)
//   • Cart UI sync  (badge, per-product buttons, overlay contents)
//   • Checkout      (phone mask, location, validation, sendData)
//   • Reorder       (orders → cart → checkout)
// =========================================================================

(function () {
    'use strict';

    // ---------------------------------------------------------------
    // Telegram bootstrap
    // ---------------------------------------------------------------
    const tg = (window.Telegram && window.Telegram.WebApp) || null;
    if (tg) {
        try { tg.ready(); } catch {}
        try { tg.expand(); } catch {}
        try { tg.setHeaderColor('#111111'); } catch {}
        try { tg.setBackgroundColor('#1a1a1a'); } catch {}
    }

    function haptic(style) {
        try {
            if (tg && tg.HapticFeedback) {
                if (style === 'success' || style === 'error' || style === 'warning') {
                    tg.HapticFeedback.notificationOccurred(style);
                } else {
                    tg.HapticFeedback.impactOccurred(style || 'light');
                }
            }
        } catch {}
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------
    const $  = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    function formatPrice(n) {
        return Number(n || 0).toLocaleString('en-US').replace(/,/g, ' ') + " so'm";
    }

    function showToast(msg, kind) {
        const el = $('#toast');
        el.textContent = msg;
        el.classList.toggle('toast--error', kind === 'error');
        el.hidden = false;
        clearTimeout(showToast._t);
        showToast._t = setTimeout(() => { el.hidden = true; }, 2400);
    }

    function instantiate(templateId) {
        const tpl = document.getElementById(templateId);
        return tpl.content.firstElementChild.cloneNode(true);
    }

    // Local cache of products and categories — used for reorder lookups
    // and to keep image URLs in sync even when cart fell back to slim mode.
    const productCache = new Map();   // id -> product
    const categoryCache = new Map();  // id -> category

    // ---------------------------------------------------------------
    // Server-provided business rules + computed delivery state.
    // Populated on boot from GET /api/restaurant + GET /api/status.
    // Fallback defaults match bot/config.js so the UI is still usable
    // if the boot fetches fail (e.g. transient network blip).
    // ---------------------------------------------------------------
    let cfg = {
        restaurant_lat: 39.6702766,
        restaurant_lon: 66.9373603,
        free_delivery_km: 4,
        per_km_fee: 5000,
        min_order_total: 70000,
    };
    let isOpen = true;

    // Delivery state — what the checkout currently believes
    //   source: 'location' | 'geocoded' | 'unknown' | null
    let delivery = { source: null, distanceKm: null, fee: 0, message: '' };

    function haversineKm(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const toRad = (d) => (d * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function feeForKm(km) {
        if (!Number.isFinite(km) || km <= cfg.free_delivery_km) return 0;
        return Math.ceil(km - cfg.free_delivery_km) * cfg.per_km_fee;
    }

    function formatKm(km) {
        return km.toFixed(1).replace('.', ',') + ' km';
    }

    // ---------------------------------------------------------------
    // Routing
    // ---------------------------------------------------------------
    function navigateTo(pageName) {
        $$('.page').forEach((p) => p.classList.toggle('page--active', p.id === `page-${pageName}`));
        $$('.nav-btn').forEach((b) => b.classList.toggle('nav-btn--active', b.dataset.page === pageName));
        if (pageName === 'orders') loadOrders();
        if (pageName === 'home') showView('categories');
        window.scrollTo({ top: 0, behavior: 'instant' });
    }

    function showView(viewName) {
        $$('.view').forEach((v) => v.classList.toggle('view--active', v.id === `view-${viewName}`));
    }

    // ---------------------------------------------------------------
    // Categories
    // ---------------------------------------------------------------
    async function loadCategories() {
        const grid = $('#categories-grid');
        try {
            const { categories } = await api.getCategories();
            grid.innerHTML = '';
            categories.forEach((c) => {
                categoryCache.set(c.id, c);
                const card = instantiate('tpl-category-card');
                card.dataset.id = c.id;
                $('.cat-card__name', card).textContent = c.name;
                const img = $('.cat-card__img', card);
                img.src = c.image_url || '';
                img.alt = c.name;
                card.addEventListener('click', () => openCategory(c));
                grid.appendChild(card);
            });
        } catch (err) {
            console.error('loadCategories failed', err);
            showToast(err.kind === 'network'
                ? 'Tarmoq xatosi. Qayta urinib ko\'ring.'
                : 'Kategoriyalarni yuklashda xato.', 'error');
        }
    }

    // ---------------------------------------------------------------
    // Products of a chosen category
    // ---------------------------------------------------------------
    let currentCategoryId = null;

    function renderProductSkeletons(n = 6) {
        const list = $('#products-list');
        list.innerHTML = '';
        for (let i = 0; i < n; i++) {
            list.appendChild(instantiate('tpl-skeleton-product'));
        }
    }

    async function openCategory(cat) {
        currentCategoryId = cat.id;
        $('#products-title').textContent = cat.name;
        showView('products');
        window.scrollTo({ top: 0, behavior: 'instant' });
        renderProductSkeletons(6);

        try {
            const { products } = await api.getProducts(cat.id);
            renderProducts(products);
        } catch (err) {
            console.error('loadProducts failed', err);
            $('#products-list').innerHTML = '';
            showToast('Mahsulotlarni yuklashda xato.', 'error');
        }
    }

    function renderProducts(products) {
        const list = $('#products-list');
        list.innerHTML = '';
        if (!products.length) {
            list.innerHTML = `
                <div class="empty-state">
                    <h3>Hozircha mahsulotlar yo'q</h3>
                    <p>Tez kunda yangilanadi 🍔</p>
                </div>`;
            return;
        }
        products.forEach((p) => {
            productCache.set(p.id, p);
            const card = instantiate('tpl-product-card');
            card.dataset.id = p.id;
            $('.prod-card__name', card).textContent = p.name;
            $('.prod-card__price', card).textContent = formatPrice(p.price);
            // Combo contents / description, when present.
            const descEl = $('.prod-card__desc', card);
            if (descEl) {
                if (p.description && p.description.trim()) {
                    descEl.textContent = p.description;
                    descEl.hidden = false;
                } else {
                    descEl.hidden = true;
                }
            }
            const img = $('.prod-card__img', card);
            img.src = p.image_url || '';
            img.alt = p.name;
            renderProductAction(card, p);
            list.appendChild(card);
        });
    }

    function renderProductAction(card, product) {
        const slot = $('.prod-card__action', card);
        slot.innerHTML = '';
        const qty = cart.quantityOf(product.id);
        if (qty === 0) {
            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'add-btn';
            addBtn.textContent = '➕ Savatga qo\'shish';
            addBtn.addEventListener('click', () => {
                cart.add(product);
                haptic('light');
            });
            slot.appendChild(addBtn);
        } else {
            const stepper = document.createElement('div');
            stepper.className = 'qty-stepper';
            stepper.innerHTML = `
                <button type="button" aria-label="Kamaytirish">−</button>
                <span class="qty-val">${qty}</span>
                <button type="button" aria-label="Oshirish">+</button>
            `;
            const [minus, , plus] = stepper.children;
            minus.addEventListener('click', () => { cart.dec(product.id); haptic('light'); });
            plus.addEventListener('click',  () => { cart.inc(product.id); haptic('light'); });
            slot.appendChild(stepper);
        }
    }

    // Re-render the action area for visible product cards whenever cart changes.
    function refreshVisibleProductActions() {
        $$('#products-list .prod-card[data-id]').forEach((card) => {
            const id = Number(card.dataset.id);
            const product = productCache.get(id);
            if (product) renderProductAction(card, product);
        });
    }

    // ---------------------------------------------------------------
    // Cart icon badge
    // ---------------------------------------------------------------
    function updateCartBadge(snapshot) {
        const badge = $('#cart-badge');
        if (snapshot.count > 0) {
            badge.textContent = String(snapshot.count);
            badge.hidden = false;
        } else {
            badge.hidden = true;
        }
    }

    // ---------------------------------------------------------------
    // Cart overlay
    // ---------------------------------------------------------------
    function renderCart(snapshot) {
        const list = $('#cart-items');
        list.innerHTML = '';

        const warn = $('#min-order-warn');

        if (snapshot.items.length === 0) {
            list.classList.add('cart-items--empty');
            $('#cart-total').textContent = formatPrice(0);
            $('#open-checkout').disabled = true;
            if (warn) warn.hidden = true;
            return;
        }
        list.classList.remove('cart-items--empty');

        // Minimum-order gate: under the threshold the checkout button is
        // disabled and a red note shows how far we are from unlocking it.
        const belowMin = snapshot.total < cfg.min_order_total;
        $('#open-checkout').disabled = belowMin;
        if (warn) {
            if (belowMin) {
                warn.textContent =
                    `Minimal buyurtma summasi: ${formatPrice(cfg.min_order_total)} ` +
                    `(hozir: ${formatPrice(snapshot.total)})`;
                warn.hidden = false;
            } else {
                warn.hidden = true;
            }
        }

        snapshot.items.forEach((it) => {
            const row = instantiate('tpl-cart-item');
            row.dataset.id = it.product_id;
            $('.cart-item__name', row).textContent = it.name;
            $('.cart-item__price', row).textContent = formatPrice(it.price);
            $('.cart-item__img', row).src = it.image_url
                || (productCache.get(it.product_id) || {}).image_url
                || '';
            $('.qty-val', row).textContent = it.quantity;

            $('[data-action="dec"]', row).addEventListener('click', () => {
                cart.dec(it.product_id); haptic('light');
            });
            $('[data-action="inc"]', row).addEventListener('click', () => {
                cart.inc(it.product_id); haptic('light');
            });
            $('[data-action="remove"]', row).addEventListener('click', () => {
                cart.remove(it.product_id); haptic('warning');
            });

            list.appendChild(row);
        });

        $('#cart-total').textContent = formatPrice(snapshot.total);
    }

    // Keeps the checkout total in sync with the cart. The checkout
    // overlay is its own DOM subtree, so renderCart's #cart-total update
    // doesn't reach it — we need a dedicated hook.
    //
    // Itemizes the bill so the customer can see *why* the total is what
    // it is: subtotal + delivery, then the grand total below.
    function renderCheckoutTotal(snapshot) {
        const subtotal = snapshot.total;
        const fee = delivery.fee || 0;

        const subEl   = document.getElementById('checkout-subtotal');
        const feeEl   = document.getElementById('checkout-delivery');
        const feeRow  = document.getElementById('checkout-delivery-row');
        const totalEl = document.getElementById('checkout-total');

        if (subEl)   subEl.textContent = formatPrice(subtotal);
        if (totalEl) totalEl.textContent = formatPrice(subtotal + fee);

        if (feeRow) {
            // Show the row whenever we have a delivery state we want to
            // surface (computed fee or unknown / message).
            const visible = delivery.source != null;
            feeRow.hidden = !visible;
            if (visible && feeEl) {
                if (delivery.source === 'unknown') {
                    feeEl.textContent = 'Telefonda';
                } else {
                    feeEl.textContent = fee === 0 ? 'Bepul' : formatPrice(fee);
                }
            }
        }

        // Min-order warning under the confirm button (separate from cart-side).
        const cWarn = document.getElementById('checkout-min-warn');
        if (cWarn) {
            if (subtotal < cfg.min_order_total) {
                cWarn.textContent =
                    `Minimal buyurtma summasi: ${formatPrice(cfg.min_order_total)} ` +
                    `(hozir: ${formatPrice(subtotal)})`;
                cWarn.hidden = false;
            } else {
                cWarn.hidden = true;
            }
        }
    }

    // ---------------------------------------------------------------
    // Delivery state — recomputed whenever the customer picks a
    // location, types an address, or the cart changes.
    // ---------------------------------------------------------------
    function setDelivery(state) {
        delivery = { source: null, distanceKm: null, fee: 0, message: '', ...state };
        const info = document.getElementById('delivery-info');
        if (!info) return;

        info.classList.remove('delivery-info--loading', 'delivery-info--error');
        if (!delivery.source) {
            info.hidden = true;
        } else if (delivery.source === 'loading') {
            info.hidden = false;
            info.classList.add('delivery-info--loading');
            info.textContent = '⏳ Manzilni tekshirmoqdamiz…';
        } else if (delivery.source === 'unknown') {
            info.hidden = false;
            info.classList.add('delivery-info--error');
            info.textContent = '📍 Manzilni xaritada topa olmadik — dostavka narxi telefonda aniqlanadi';
        } else {
            info.hidden = false;
            const feeStr = delivery.fee === 0 ? 'Bepul' : formatPrice(delivery.fee);
            info.textContent = `📍 Sizdan ${formatKm(delivery.distanceKm)} | Dostavka: ${feeStr}`;
        }

        // Trigger a checkout total redraw with the latest fee.
        renderCheckoutTotal({ total: cart.getTotal() });
    }

    // Distance from picked GPS coords — instant, no network.
    function applyDeliveryFromCoords(lat, lon) {
        const km = haversineKm(cfg.restaurant_lat, cfg.restaurant_lon, lat, lon);
        setDelivery({ source: 'location', distanceKm: km, fee: feeForKm(km) });
    }

    // Distance from a free-form address — async geocoding via the bot.
    let geocodeSeq = 0;
    let geocodeTimer = null;
    function applyDeliveryFromAddress(address) {
        clearTimeout(geocodeTimer);
        if (!address || address.length < 4) {
            // Not enough text yet — leave whatever the last state was alone,
            // unless we had nothing, in which case show no row.
            if (delivery.source !== 'location') setDelivery({ source: null });
            return;
        }
        setDelivery({ source: 'loading' });

        const seq = ++geocodeSeq;
        geocodeTimer = setTimeout(async () => {
            try {
                const r = await api.geocode(address);
                if (seq !== geocodeSeq) return; // a newer request raced ahead
                const km = haversineKm(
                    cfg.restaurant_lat, cfg.restaurant_lon,
                    Number(r.lat), Number(r.lon)
                );
                setDelivery({ source: 'geocoded', distanceKm: km, fee: feeForKm(km) });
            } catch (err) {
                if (seq !== geocodeSeq) return;
                // 404 → not found; other errors → also unknown.
                setDelivery({ source: 'unknown' });
            }
        }, 700);
    }

    // ---------------------------------------------------------------
    // Overlays (cart + checkout)
    // ---------------------------------------------------------------
    function openOverlay(name) {
        const el = document.getElementById(`${name}-overlay`);
        el.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeOverlay(name) {
        const el = document.getElementById(`${name}-overlay`);
        el.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    function wireOverlayCloseButtons() {
        $$('[data-close]').forEach((el) => {
            el.addEventListener('click', () => closeOverlay(el.dataset.close));
        });
    }

    // ---------------------------------------------------------------
    // Checkout: phone mask
    // ---------------------------------------------------------------
    // Storage format (returned): "+998901234567"
    // Display format:            "+998 (90) 123-45-67"
    function formatPhoneDisplay(rawDigits) {
        // rawDigits is just the 9 local digits (after the country code).
        const d = rawDigits;
        if (d.length === 0) return '';
        let out = '+998';
        out += ' (' + d.slice(0, Math.min(2, d.length));
        if (d.length >= 2) out += ')';
        if (d.length > 2) out += ' ' + d.slice(2, Math.min(5, d.length));
        if (d.length > 5) out += '-' + d.slice(5, Math.min(7, d.length));
        if (d.length > 7) out += '-' + d.slice(7, 9);
        return out;
    }

    function extractLocalDigits(value) {
        let digits = String(value || '').replace(/\D/g, '');
        // Drop the 998 country prefix if user typed/pasted it.
        if (digits.startsWith('998')) digits = digits.slice(3);
        // Drop a leading "8" if it looks like an old-style 10-digit form.
        else if (digits.length === 10 && digits.startsWith('8')) digits = digits.slice(1);
        return digits.slice(0, 9);
    }

    function isPhoneComplete(value) {
        return extractLocalDigits(value).length === 9;
    }

    function attachPhoneMask(input, onChange) {
        const handler = () => {
            const local = extractLocalDigits(input.value);
            input.value = formatPhoneDisplay(local);
            onChange();
        };
        input.addEventListener('input', handler);
        input.addEventListener('paste', () => setTimeout(handler, 0));
        input.addEventListener('focus', () => {
            if (!input.value) input.value = '+998 (';
        });
        input.addEventListener('blur', () => {
            if (extractLocalDigits(input.value).length === 0) input.value = '';
        });
    }

    function rawPhone(value) {
        const local = extractLocalDigits(value);
        return local.length === 9 ? '+998' + local : '';
    }

    // ---------------------------------------------------------------
    // Checkout: location
    // ---------------------------------------------------------------
    let pickedLocation = null; // { latitude, longitude } | null

    function setLocationStatus(text, ok = true) {
        const el = $('#loc-status');
        if (!text) { el.hidden = true; return; }
        el.hidden = false;
        el.textContent = text;
        el.classList.toggle('field__hint--ok', ok);
        el.classList.toggle('field__hint--err', !ok);
    }

    let locBusy = false;

    function requestLocation() {
        if (locBusy) return;
        locBusy = true;

        const setBtn = (label) => { $('#loc-btn-label').textContent = label; };
        setBtn('⏳ Aniqlanmoqda…');
        setLocationStatus('', true);

        let settled = false;
        const finish = () => { settled = true; locBusy = false; };

        const onOk = (lat, lon) => {
            if (settled) return;
            finish();
            pickedLocation = { latitude: lat, longitude: lon };
            setLocationStatus('📍 Joylashuv aniqlandi ✅', true);
            setBtn('📍 Joylashuv yangilash');
            applyDeliveryFromCoords(lat, lon);
            updateConfirmEnabled();
            haptic('success');
        };
        const onFail = (msg) => {
            if (settled) return;
            finish();
            pickedLocation = null;
            setLocationStatus(msg || 'Joylashuv aniqlanmadi. Manzilni qo\'lda kiriting', false);
            setBtn('📍 Joylashuvni avtomatik yuborish');
            const manual = $('#f-address').value.trim();
            if (manual) applyDeliveryFromAddress(manual);
            else setDelivery({ source: null });
            updateConfirmEnabled();
            haptic('error');
        };

        // Safety net: if neither API ever calls back, don't hang forever.
        const watchdog = setTimeout(() => onFail('Joylashuv aniqlanmadi. Manzilni qo\'lda kiriting'), 20000);
        const ok = (lat, lon) => { clearTimeout(watchdog); onOk(lat, lon); };
        const fail = (m) => { clearTimeout(watchdog); onFail(m); };

        // --- Browser geolocation fallback ---------------------------------
        const useGeolocation = () => {
            if (!navigator.geolocation) {
                fail('Qurilma joylashuvni qo\'llab-quvvatlamaydi. Manzilni qo\'lda kiriting');
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => ok(pos.coords.latitude, pos.coords.longitude),
                (err) => {
                    // PERMISSION_DENIED = 1
                    if (err && err.code === 1) {
                        fail('Joylashuvga ruxsat berilmadi. Manzilni qo\'lda kiriting');
                    } else {
                        fail('Joylashuv aniqlanmadi. Manzilni qo\'lda kiriting');
                    }
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
            );
        };

        // --- Telegram LocationManager (Bot API 8.0+) ----------------------
        const lm = tg && tg.LocationManager;
        if (lm && typeof lm.getLocation === 'function') {
            const proceed = () => {
                if (lm.isLocationAvailable === false) {
                    // Device/Telegram can't provide location → browser fallback.
                    useGeolocation();
                    return;
                }
                lm.getLocation((loc) => {
                    if (loc && Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)) {
                        ok(loc.latitude, loc.longitude);
                    } else if (lm.isAccessRequested && lm.isAccessGranted === false) {
                        // User explicitly denied — point them to settings.
                        try { lm.openSettings && lm.openSettings(); } catch {}
                        fail('Joylashuvga ruxsat berilmadi. Sozlamalardan ruxsat bering yoki manzilni qo\'lda kiriting');
                    } else {
                        // Null without explicit denial → try browser API.
                        useGeolocation();
                    }
                });
            };
            try {
                if (lm.isInited) proceed();
                else lm.init(proceed);
                return;
            } catch (err) {
                console.warn('[loc] LocationManager error, falling back:', err);
            }
        }

        // --- Some clients expose a direct requestLocation() ----------------
        if (tg && typeof tg.requestLocation === 'function') {
            try {
                tg.requestLocation((loc) => {
                    if (loc && Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)) {
                        ok(loc.latitude, loc.longitude);
                    } else {
                        useGeolocation();
                    }
                });
                return;
            } catch (err) {
                console.warn('[loc] requestLocation error, falling back:', err);
            }
        }

        // --- Default: browser geolocation ---------------------------------
        useGeolocation();
    }

    // ---------------------------------------------------------------
    // Checkout: validation + submit
    // ---------------------------------------------------------------
    function updateConfirmEnabled() {
        const name = $('#f-name').value.trim();
        const phoneOk = isPhoneComplete($('#f-phone').value);
        const address = $('#f-address').value.trim();
        const hasAnyAddress = !!pickedLocation || address.length > 0;
        const subtotal = cart.getTotal();
        const minOk = subtotal >= cfg.min_order_total;

        // Per-field hints.
        const phoneHint = $('#phone-hint');
        if ($('#f-phone').value && !phoneOk) {
            phoneHint.textContent = "⚠️ Telefon raqami to'liq emas: +998 (XX) XXX-XX-XX";
            phoneHint.classList.add('field__hint--err');
            phoneHint.hidden = false;
        } else {
            phoneHint.hidden = true;
        }

        const addrHint = $('#address-hint');
        if (!hasAnyAddress && (name || $('#f-phone').value)) {
            addrHint.textContent = "⚠️ Iltimos, manzilni kiriting yoki joylashuvni yuboring";
            addrHint.classList.add('field__hint--err');
            addrHint.hidden = false;
        } else {
            addrHint.hidden = true;
        }

        const ready =
            !!name &&
            phoneOk &&
            hasAnyAddress &&
            cart.getCount() > 0 &&
            minOk &&
            isOpen;
        $('#confirm-btn').disabled = !ready;
    }

    function buildOrderPayload() {
        const items = cart.getItems().map((it) => ({
            product_id: it.product_id,
            name: it.name,
            price: Number(it.price) || 0,
            quantity: Number(it.quantity) || 0,
        }));

        // Address text: if location was picked AND no manual text was typed,
        // fall back to a friendly stub the admin can interpret on the map.
        const manualAddress = $('#f-address').value.trim();
        const addressText = manualAddress || (pickedLocation
            ? `Geolokatsiya: ${pickedLocation.latitude.toFixed(6)}, ${pickedLocation.longitude.toFixed(6)}`
            : '');

        const subtotal = cart.getTotal();
        const deliveryFee = delivery.fee || 0;
        const commentRaw = $('#f-comment') ? $('#f-comment').value.trim() : '';

        return {
            customer_name: $('#f-name').value.trim(),
            customer_phone: rawPhone($('#f-phone').value),
            latitude:  pickedLocation ? pickedLocation.latitude  : null,
            longitude: pickedLocation ? pickedLocation.longitude : null,
            address_text: addressText,
            comment: commentRaw || null,
            items,
            // Informational — server re-derives these from items + coords:
            subtotal,
            delivery_fee: deliveryFee,
            distance_km: delivery.distanceKm != null
                ? Number(delivery.distanceKm.toFixed(2))
                : null,
            total_amount: subtotal + deliveryFee,
        };
    }

    function submitOrder(evt) {
        evt.preventDefault();
        updateConfirmEnabled();
        if ($('#confirm-btn').disabled) return;

        // Guard rail: outside hours we don't want to send anything even
        // if a stale UI state somehow left the button enabled.
        if (!isOpen) {
            showToast(
                "Uzr, hozir qabul vaqtimiz tugagan. Ish vaqtimiz: " +
                ($('#closed-banner-hours').textContent || '10:00 - 03:00'),
                'error'
            );
            return;
        }

        if (!tg || typeof tg.sendData !== 'function') {
            showToast('Mini App Telegram orqali ochilishi kerak.', 'error');
            return;
        }

        const payload = buildOrderPayload();
        haptic('success');
        try {
            tg.sendData(JSON.stringify(payload));
        } catch (err) {
            console.error('sendData failed', err);
            showToast('Buyurtmani yuborishda xato. Qayta urinib ko\'ring.', 'error');
            return;
        }
        // After sendData, Telegram closes the Mini App. Still — clean local state.
        cart.clear();
    }

    // ---------------------------------------------------------------
    // Orders page
    // ---------------------------------------------------------------
    const ORDER_STATUS_LABEL = {
        new: 'Yangi',
        accepted: 'Tasdiqlangan',
        preparing: 'Tayyorlanmoqda',
        delivering: 'Yetkazilmoqda',
        delivered: 'Yetkazildi',
        cancelled: 'Bekor qilindi',
    };

    function formatOrderDate(iso) {
        try {
            return new Date(iso).toLocaleString('uz-UZ', {
                year: '2-digit', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit',
            });
        } catch { return iso; }
    }

    function renderOrderItems(items) {
        if (!Array.isArray(items)) return '';
        return items
            .map((it) => `${it.name} ×${it.quantity}`)
            .join(' · ');
    }

    async function loadOrders() {
        const list = $('#orders-list');
        list.innerHTML = `
            <div class="empty-state"><p style="color: var(--c-text-muted)">Yuklanmoqda…</p></div>`;

        try {
            const { orders } = await api.getOrders();
            list.innerHTML = '';
            if (!orders.length) {
                list.innerHTML = `
                    <div class="empty-state">
                        <h3>Hali buyurtmalar yo'q</h3>
                        <p>Birinchi buyurtmangizni bering 🍔</p>
                    </div>`;
                return;
            }
            orders.forEach((o) => {
                const card = instantiate('tpl-order-card');
                $('.order-card__id', card).textContent = `#${o.id}`;
                $('.order-card__date', card).textContent = formatOrderDate(o.created_at);
                $('.order-card__items', card).textContent = renderOrderItems(o.items);
                $('.order-card__status', card).textContent = ORDER_STATUS_LABEL[o.status] || o.status;
                $('.order-card__total', card).textContent = formatPrice(o.total_amount);
                $('.order-card__reorder', card).addEventListener('click', () => reorder(o));
                list.appendChild(card);
            });
        } catch (err) {
            console.error('loadOrders failed', err);
            list.innerHTML = `
                <div class="empty-state">
                    <p style="color: var(--c-error)">Buyurtmalarni yuklashda xato.</p>
                </div>`;
        }
    }

    async function reorder(order) {
        if (!Array.isArray(order.items) || order.items.length === 0) return;
        // Push items into cart, looking up the latest image from product cache.
        for (const it of order.items) {
            const cached = productCache.get(it.product_id);
            cart.add({
                id: it.product_id,
                name: it.name,
                price: Number(it.price) || 0,
                image_url: cached ? cached.image_url : null,
            }, Number(it.quantity) || 1);
        }
        navigateTo('home');
        openOverlay('cart');
        // Move straight to checkout — fewer taps.
        setTimeout(() => {
            closeOverlay('cart');
            openOverlay('checkout');
            updateConfirmEnabled();
        }, 250);
    }

    // ---------------------------------------------------------------
    // Boot
    // ---------------------------------------------------------------
    function wireUI() {
        // Bottom nav
        $$('.nav-btn').forEach((btn) => {
            btn.addEventListener('click', () => navigateTo(btn.dataset.page));
        });

        // Back to categories
        $('#back-to-categories').addEventListener('click', () => showView('categories'));

        // Cart icon
        $('#cart-icon').addEventListener('click', () => openOverlay('cart'));

        // Cart -> checkout
        $('#open-checkout').addEventListener('click', () => {
            if (cart.getCount() === 0) return;
            closeOverlay('cart');
            openOverlay('checkout');
            updateConfirmEnabled();
        });

        // Overlay close buttons + backdrops
        wireOverlayCloseButtons();

        // Checkout form: phone mask + live validation
        attachPhoneMask($('#f-phone'), updateConfirmEnabled);
        $('#f-name').addEventListener('input', updateConfirmEnabled);
        $('#f-address').addEventListener('input', () => {
            const v = $('#f-address').value.trim();
            // Auto-picked GPS coords always win — typing in the textarea
            // adds free-form details but doesn't re-geocode in that case.
            if (!pickedLocation) applyDeliveryFromAddress(v);
            updateConfirmEnabled();
        });
        $('#loc-btn').addEventListener('click', requestLocation);

        $('#checkout-form').addEventListener('submit', submitOrder);
    }

    // -------------------------------------------------------------------
    // Telegram launch diagnostic — if the Mini App was opened OUTSIDE of
    // a Telegram WebView entry point (e.g. directly in a browser, from
    // an inline button without Web App context, or a saved bookmark),
    // `Telegram.WebApp.initData` is empty and every /api/* call returns
    // 401 "missing initData". That is the leading user-visible failure
    // mode, so we surface it as a full-screen banner with the relevant
    // diagnostic data instead of a fleeting toast.
    function diagnoseTelegramLaunch() {
        const hasTg = !!(window.Telegram && window.Telegram.WebApp);
        const initData = hasTg ? (tg.initData || '') : '';
        const platform = hasTg ? (tg.platform || 'unknown') : 'no-sdk';
        const version  = hasTg ? (tg.version  || 'unknown') : '—';

        // The Mini App fragment Telegram appends to our URL. Inspecting it
        // tells us EXACTLY what Telegram delivered:
        //   • contains tgWebAppData=...  → Telegram sent the auth blob,
        //     our JS just isn't picking it up (bug on our side).
        //   • no tgWebAppData            → Telegram didn't send it
        //     (BotFather config, wrong button type, etc).
        const hash = window.location.hash || '';
        const hashKeys = hash
            .replace(/^#/, '')
            .split('&')
            .map((s) => s.split('=')[0])
            .filter(Boolean);
        const hasFragmentData = hashKeys.includes('tgWebAppData');

        console.log('[diag] Telegram.WebApp present =', hasTg);
        console.log('[diag] initData length         =', initData.length);
        console.log('[diag] platform                =', platform);
        console.log('[diag] version                 =', version);
        console.log('[diag] location.hash keys      =', hashKeys);
        console.log('[diag] has tgWebAppData        =', hasFragmentData);
        console.log('[diag] location.href           =', window.location.href);
        if (hasTg && tg.initDataUnsafe) {
            console.log('[diag] initDataUnsafe        =', tg.initDataUnsafe);
        }

        // Also POST the diagnostic to the server so we don't need to
        // ask the user for a screenshot. This call doesn't carry initData
        // (we know it's empty), so the route is whitelisted in index.js.
        if (!initData) {
            try {
                fetch((window.API_BASE || '/api') + '/_diag', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'ngrok-skip-browser-warning': '1',
                    },
                    body: JSON.stringify({
                        hasTg, platform, version,
                        initDataLen: initData.length,
                        hashKeys, hasFragmentData,
                        href: window.location.href,
                        userAgent: navigator.userAgent,
                    }),
                }).catch(() => {});
            } catch {}
        }

        // No banner — server-side dev bypass (when NODE_ENV !== 'production')
        // accepts the requests anyway and returns real data. In production
        // the server returns 401 and the per-page error handlers surface a
        // toast / inline message to the user.
        return initData.length > 0;
    }

    function applyOpenStatus(status) {
        isOpen = !!status.is_open;
        const banner = document.getElementById('closed-banner');
        const hoursEl = document.getElementById('closed-banner-hours');
        if (hoursEl && status.hours_label) hoursEl.textContent = status.hours_label;
        if (banner) banner.hidden = isOpen;
        // Re-evaluate confirm button — closed disables it.
        updateConfirmEnabled();
    }

    // Pull restaurant config + open/closed status from the server.
    // Runs in parallel with everything else; failures fall back to the
    // defaults baked into `cfg` and `isOpen=true`.
    async function loadServerConfig() {
        try {
            const [r, s] = await Promise.all([
                api.getRestaurant(),
                api.getStatus(),
            ]);
            if (r) {
                cfg = {
                    restaurant_lat:   r.lat ?? cfg.restaurant_lat,
                    restaurant_lon:   r.lon ?? cfg.restaurant_lon,
                    free_delivery_km: r.free_delivery_km ?? cfg.free_delivery_km,
                    per_km_fee:       r.per_km_fee ?? cfg.per_km_fee,
                    min_order_total:  r.min_order_total ?? cfg.min_order_total,
                };
            }
            if (s) applyOpenStatus(s);
        } catch (err) {
            console.warn('[boot] /api/status or /api/restaurant failed:', err.message);
        }
    }

    async function boot() {
        wireUI();
        diagnoseTelegramLaunch();
        await cart.init();
        cart.subscribe((snap) => {
            updateCartBadge(snap);
            renderCart(snap);
            renderCheckoutTotal(snap);
            refreshVisibleProductActions();
            updateConfirmEnabled();
        });
        loadCategories();
        loadServerConfig();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
