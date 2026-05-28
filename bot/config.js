// =========================================================================
// Marsexpress24 — shared business rules
// File: bot/config.js
//
// Single source of truth for restaurant geography, pricing thresholds,
// working-hours window and the small geo helpers built on top of them.
// Imported by both index.js (bot logic) and routes/api.js (REST API), so
// the Mini App, the bot handler and the admin receipt always agree.
// =========================================================================

'use strict';

// -------------------------------------------------------------------------
// Restaurant location
//   "Samarqand, Gagarin ko'chasi, 36" — OSM has the street geometry but
//   not house 36, so we anchor on the centre of the relevant Gagarin
//   segment (Nominatim lookup, 2026-05-28).
// -------------------------------------------------------------------------
const RESTAURANT_LAT = 39.6702766;
const RESTAURANT_LON = 66.9373603;
const RESTAURANT_ADDRESS = "Samarqand, Gagarin ko'chasi, 36";

// -------------------------------------------------------------------------
// Order rules
// -------------------------------------------------------------------------
const FREE_DELIVERY_KM = 4;         // km — free zone radius
const PER_KM_FEE       = 5_000;     // so'm per km beyond the free zone
const MIN_ORDER_TOTAL  = 70_000;    // so'm — minimum cart subtotal

// -------------------------------------------------------------------------
// Working hours (Asia/Tashkent, UTC+5)
//   10:00–23:59 and 00:00–02:59 are OPEN; 03:00–09:59 is CLOSED.
// -------------------------------------------------------------------------
const WORK_HOUR_OPEN       = 10;
const WORK_HOUR_CLOSE      = 3;
const WORKING_HOURS_LABEL  = '10:00 - 03:00';
const WORKING_HOURS_TZ     = 'Asia/Tashkent';

/** Is the restaurant currently open? */
function isWorkingHours(now = new Date()) {
    const hourStr = new Intl.DateTimeFormat('en-US', {
        timeZone: WORKING_HOURS_TZ,
        hour: 'numeric',
        hour12: false,
    }).format(now);
    const hour = (parseInt(hourStr, 10) || 0) % 24;
    return hour >= WORK_HOUR_OPEN || hour < WORK_HOUR_CLOSE;
}

/** Great-circle distance in km between two points (Haversine). */
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

/** Delivery fee from a distance in km. */
function deliveryFeeFor(distanceKm) {
    if (!Number.isFinite(distanceKm) || distanceKm <= FREE_DELIVERY_KM) return 0;
    const extraKm = Math.ceil(distanceKm - FREE_DELIVERY_KM);
    return extraKm * PER_KM_FEE;
}

module.exports = {
    RESTAURANT_LAT,
    RESTAURANT_LON,
    RESTAURANT_ADDRESS,
    FREE_DELIVERY_KM,
    PER_KM_FEE,
    MIN_ORDER_TOTAL,
    WORK_HOUR_OPEN,
    WORK_HOUR_CLOSE,
    WORKING_HOURS_LABEL,
    WORKING_HOURS_TZ,
    isWorkingHours,
    haversineKm,
    deliveryFeeFor,
};
