-- =========================================================================
-- Marsexpress24 — split "Combo Set" into 4 combo categories
-- File: bot/migrations/006_combo_categories.sql
--
-- The single "Combo Set" (category_id = 4, 38 products) becomes four
-- focused categories so the Mini App menu groups combos by type:
--
--     4  Lavash Combo   (renamed in place from "Combo Set")
--     5  Burger Combo   (new)
--     6  Mix Combo      (new)
--     7  Pizza Combo    (new)
--
-- Snack is bumped from sort_order 5 → 8 so it stays *last*; otherwise it
-- would collide with the new Burger Combo (also sort_order 5) and the API's
-- `ORDER BY sort_order, id` would slot Snack in the middle of the combos.
--
-- IMPORTANT — the product names below are the ACTUAL seed names from
-- 002_seed.sql, not the source spellings in the change request. Seven were
-- reconciled (the same set already documented in 003_combo_descriptions.sql);
-- without this each UPDATE would match no row and the product would be
-- stranded in Lavash Combo:
--     'Mars Love Burger'  → 'Mars Love Burger 1'
--     '1 Ramazan Combo'   → 'Ramazan Combo 1'
--     '2 Ramazan Combo'   → 'Ramazan Combo 2'
--     'Tan''tana Combo'   → 'Tantana Combo'
--     '1 Combo'           → 'Combo 1'
--     '2 Combo'           → 'Combo 2'
--     'Do''star Combo'    → 'Dostar Combo'
-- =========================================================================

BEGIN;

-- Rename the old "Combo Set" → "Lavash Combo" (stays category_id = 4).
UPDATE categories
   SET name       = 'Lavash Combo',
       image_url  = 'assets/categories/lavash_combo_card.png',
       sort_order = 4
 WHERE id = 4;

-- Keep Snack last (5 → 8) so the four combos occupy 4..7 uncontested.
UPDATE categories SET sort_order = 8 WHERE name = 'Snack';

-- Three new combo categories (serial ids 6, 7, 8).
INSERT INTO categories (name, image_url, sort_order) VALUES
    ('Burger Combo', 'assets/categories/burger_combo_card.png', 5),
    ('Mix Combo',    'assets/categories/mix_combo_card.png',    6),
    ('Pizza Combo',  'assets/categories/pizza_combo_card.png',  7);

-- LAVASH COMBO (category_id = 4) — 5 items.
UPDATE products SET category_id = 4 WHERE name IN (
    'Roll Lunch', 'Friends Lavash', 'Oila Lavash',
    'Lux Lavash', 'Zero Lavash 4'
);

-- BURGER COMBO — 9 items.
UPDATE products SET category_id = (
    SELECT id FROM categories WHERE name = 'Burger Combo'
) WHERE name IN (
    'Oila Burger', 'Friends Burger', 'King Mars',
    'Zero Burger 4', 'Lux Burger', 'Big Family',
    'Mars Love Burger 1', 'Big Duet', 'Burger Lunch'
);

-- MIX COMBO — 14 items.
UPDATE products SET category_id = (
    SELECT id FROM categories WHERE name = 'Mix Combo'
) WHERE name IN (
    'Mix Lanch', 'Sherif', 'Samarqand Combo',
    'Amore Combo', 'By Raximov Combo', 'Student Combo',
    'Aristokrat Combo', 'Spice Combo', 'Star Combo',
    'Ramazan Mix Combo', 'Iftar Combo', 'Ramazan Combo 2',
    'Legenda Combo', 'Ramazan Combo 1'
);

-- PIZZA COMBO — 9 items.
UPDATE products SET category_id = (
    SELECT id FROM categories WHERE name = 'Pizza Combo'
) WHERE name IN (
    'Tantana Combo', 'Combo 2', 'Peperoni Combo',
    'Combo 1', 'Dostar Combo', 'Barakali Combo',
    'Combo 5', 'Combo 6', 'Combo 4'
);

-- Drop the duplicate "Mars Love Burger 2".
DELETE FROM products WHERE name = 'Mars Love Burger 2';

COMMIT;

-- =========================================================================
-- Verification (run manually if needed):
--   SELECT c.sort_order, c.name, COUNT(p.id)
--     FROM categories c LEFT JOIN products p ON p.category_id = c.id
--    GROUP BY c.id ORDER BY c.sort_order;
--   Expected combos: Lavash Combo 5, Burger Combo 9, Mix Combo 14, Pizza Combo 9
-- =========================================================================
