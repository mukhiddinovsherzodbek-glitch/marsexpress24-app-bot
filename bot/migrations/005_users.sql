-- =========================================================================
-- Marsexpress24 — per-user language preference
-- File: bot/migrations/005_users.sql
--
-- Backs the i18n feature: /start lets a user pick uz/ru, and we remember it
-- so returning users (and the Mini App) get their language without asking
-- again. Keyed by telegram id; defaults to Uzbek.
-- =========================================================================

CREATE TABLE IF NOT EXISTS users (
    telegram_user_id BIGINT PRIMARY KEY,
    language         VARCHAR(2) DEFAULT 'uz',
    created_at       TIMESTAMP DEFAULT NOW()
);
