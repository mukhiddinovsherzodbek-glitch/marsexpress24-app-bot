-- =========================================================================
-- Marsexpress24 — initial schema
-- File: bot/migrations/001_init.sql
-- Purpose: create core tables (categories, products, orders) + seed
--          the 5 fixed categories with deterministic IDs (1..5).
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- Categories
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    image_url   TEXT,
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- Products
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id            SERIAL PRIMARY KEY,
    category_id   INTEGER       NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name          VARCHAR(150)  NOT NULL,
    description   TEXT,
    price         DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    image_url     TEXT,
    is_available  BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category    ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_available   ON products(is_available);

-- -------------------------------------------------------------------------
-- Orders
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id                SERIAL PRIMARY KEY,
    telegram_user_id  BIGINT        NOT NULL,
    customer_name     VARCHAR(150),
    customer_phone    VARCHAR(20),
    latitude          DECIMAL(10,8),
    longitude         DECIMAL(11,8),
    address_text      TEXT          NOT NULL,
    items             JSONB         NOT NULL,
    total_amount      DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    status            VARCHAR(30)   NOT NULL DEFAULT 'new',
    created_at        TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user     ON orders(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created  ON orders(created_at DESC);

-- -------------------------------------------------------------------------
-- Seed categories (fixed IDs 1..5 — referenced by products seed)
-- Uses explicit IDs + setval so the SERIAL sequence stays consistent.
-- -------------------------------------------------------------------------
INSERT INTO categories (id, name, image_url, sort_order) VALUES
    (1, 'Burger',     'assets/categories/burger_card.png', 1),
    (2, 'Lavash',     'assets/categories/lavash_card.png', 2),
    (3, 'Tako',       'assets/categories/tako_card.png',   3),
    (4, 'Combo Set',  'assets/categories/combo_card.png',  4),
    (5, 'Snack',      'assets/categories/snack_card.png',  5)
ON CONFLICT (id) DO NOTHING;

SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));

COMMIT;
