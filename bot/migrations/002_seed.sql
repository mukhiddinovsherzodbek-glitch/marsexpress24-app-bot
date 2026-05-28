-- =========================================================================
-- Marsexpress24 — product seed
-- File: bot/migrations/002_seed.sql
-- Purpose: insert all 63 products across 5 categories.
--          Order within each category: by price ascending.
-- Note: PostgreSQL escapes single quote inside a string by doubling it
--       ('Go''sht' = "Go'sht").
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1) Burger (category_id = 1) — 8 items
-- -------------------------------------------------------------------------
INSERT INTO products (category_id, name, price, image_url, is_available) VALUES
    (1, 'Burger Chicken',      30000, 'assets/products/burgers/01_burger_chicken.png',      TRUE),
    (1, 'Burger BBQ',          35000, 'assets/products/burgers/02_burger_bbq.png',          TRUE),
    (1, 'Burger Chees',        35000, 'assets/products/burgers/03_burger_chees.png',        TRUE),
    (1, 'Burger Spice',        35000, 'assets/products/burgers/04_burger_spice.png',        TRUE),
    (1, 'Burger Mars',         35000, 'assets/products/burgers/05_burger_mars.png',         TRUE),
    (1, 'Burger Go''sht',      40000, 'assets/products/burgers/06_burger_gosht.png',        TRUE),
    (1, 'Burger Spice Double', 45000, 'assets/products/burgers/07_burger_spice_double.png', TRUE),
    (1, 'Big Burger Go''sht',  50000, 'assets/products/burgers/08_big_burger_gosht.png',    TRUE);

-- -------------------------------------------------------------------------
-- 2) Lavash (category_id = 2) — 6 items
-- -------------------------------------------------------------------------
INSERT INTO products (category_id, name, price, image_url, is_available) VALUES
    (2, 'Lavash Chicken', 30000, 'assets/products/lavash/01_lavash_chicken.png', TRUE),
    (2, 'Lavash Mars',    35000, 'assets/products/lavash/02_lavash_mars.png',    TRUE),
    (2, 'Lavash Spice',   35000, 'assets/products/lavash/03_lavash_spice.png',   TRUE),
    (2, 'Lavash BBQ',     35000, 'assets/products/lavash/04_lavash_bbq.png',     TRUE),
    (2, 'Lavash Chees',   35000, 'assets/products/lavash/05_lavash_chees.png',   TRUE),
    (2, 'Lavash Beef',    40000, 'assets/products/lavash/06_lavash_beef.png',    TRUE);

-- -------------------------------------------------------------------------
-- 3) Tako (category_id = 3) — 6 items
-- -------------------------------------------------------------------------
INSERT INTO products (category_id, name, price, image_url, is_available) VALUES
    (3, 'Tako Chicken',      40000, 'assets/products/tako/01_tako_chicken.png',      TRUE),
    (3, 'Tako BBQ Kolbaski', 40000, 'assets/products/tako/02_tako_bbq_kolbaski.png', TRUE),
    (3, 'Tako Go''sht Mol',  45000, 'assets/products/tako/03_tako_gosht_mol.png',    TRUE),
    (3, 'Tako Mix',          45000, 'assets/products/tako/04_tako_mix.png',          TRUE),
    (3, 'Tako Gril',         50000, 'assets/products/tako/05_tako_gril.png',         TRUE),
    (3, 'Tako Spice',        50000, 'assets/products/tako/06_tako_spice.png',        TRUE);

-- -------------------------------------------------------------------------
-- 4) Combo Set (category_id = 4) — 38 items
-- -------------------------------------------------------------------------
INSERT INTO products (category_id, name, price, image_url, is_available) VALUES
    (4, 'Roll Lunch',           45000,  'assets/products/combo/01_roll_lunch.png',          TRUE),
    (4, 'Burger Lunch',         45000,  'assets/products/combo/02_burger_lunch.png',        TRUE),
    (4, 'Combo 6',              70000,  'assets/products/combo/03_combo_6.png',             TRUE),
    (4, 'Combo 5',              70000,  'assets/products/combo/04_combo_5.png',             TRUE),
    (4, 'King Mars',            70000,  'assets/products/combo/05_king_mars.png',           TRUE),
    (4, 'Mix Lanch',            85000,  'assets/products/combo/06_mix_lanch.png',           TRUE),
    (4, 'Combo 4',              95000,  'assets/products/combo/07_combo_4.png',             TRUE),
    (4, 'Zero Burger 4',        99000,  'assets/products/combo/08_zero_burger_4.png',       TRUE),
    (4, 'Zero Lavash 4',        99000,  'assets/products/combo/09_zero_lavash_4.png',       TRUE),
    (4, 'Peperoni Combo',       99000,  'assets/products/combo/10_peperoni_combo.png',      TRUE),
    (4, 'Combo 1',              99000,  'assets/products/combo/11_combo_1.png',             TRUE),
    (4, 'Combo 2',              99000,  'assets/products/combo/12_combo_2.png',             TRUE),
    (4, 'Samarqand Combo',      110000, 'assets/products/combo/13_samarqand_combo.png',     TRUE),
    (4, 'Friends Burger',       115000, 'assets/products/combo/14_friends_burger.png',      TRUE),
    (4, 'Friends Lavash',       115000, 'assets/products/combo/15_friends_lavash.png',      TRUE),
    (4, 'Big Duet',             125000, 'assets/products/combo/16_big_duet.png',            TRUE),
    (4, 'Tantana Combo',        130000, 'assets/products/combo/17_tantana_combo.png',       TRUE),
    (4, 'Student Combo',        130000, 'assets/products/combo/18_student_combo.png',       TRUE),
    (4, 'Aristokrat Combo',     130000, 'assets/products/combo/19_aristokrat_combo.png',    TRUE),
    (4, 'Spice Combo',          145000, 'assets/products/combo/20_spice_combo.png',         TRUE),
    (4, 'Star Combo',           145000, 'assets/products/combo/21_star_combo.png',          TRUE),
    (4, 'Dostar Combo',         150000, 'assets/products/combo/22_dostar_combo.png',        TRUE),
    (4, 'Mars Love Burger 1',   155000, 'assets/products/combo/23_mars_love_burger_1.png',  TRUE),
    (4, 'Mars Love Burger 2',   155000, 'assets/products/combo/24_mars_love_burger_2.png',  TRUE),
    (4, 'By Raximov Combo',     160000, 'assets/products/combo/25_by_raximov_combo.png',    TRUE),
    (4, 'Oila Burger',          165000, 'assets/products/combo/26_oila_burger.png',         TRUE),
    (4, 'Oila Lavash',          165000, 'assets/products/combo/27_oila_lavash.png',         TRUE),
    (4, 'Sherif',               165000, 'assets/products/combo/28_sherif.png',              TRUE),
    (4, 'Big Family',           165000, 'assets/products/combo/29_big_family.png',          TRUE),
    (4, 'Ramazan Combo 1',      165000, 'assets/products/combo/30_ramazan_combo_1.png',     TRUE),
    (4, 'Ramazan Combo 2',      165000, 'assets/products/combo/31_ramazan_combo_2.png',     TRUE),
    (4, 'Ramazan Mix Combo',    165000, 'assets/products/combo/32_ramazan_mix_combo.png',   TRUE),
    (4, 'Lux Burger',           220000, 'assets/products/combo/33_lux_burger.png',          TRUE),
    (4, 'Lux Lavash',           220000, 'assets/products/combo/34_lux_lavash.png',          TRUE),
    (4, 'Legenda Combo',        220000, 'assets/products/combo/35_legenda_combo.png',       TRUE),
    (4, 'Iftar Combo',          225000, 'assets/products/combo/36_iftar_combo.png',         TRUE),
    (4, 'Barakali Combo',       225000, 'assets/products/combo/37_barakali_combo.png',      TRUE),
    (4, 'Amore Combo',          230000, 'assets/products/combo/38_amore_combo.png',         TRUE);

-- -------------------------------------------------------------------------
-- 5) Snack (category_id = 5) — 5 items
-- -------------------------------------------------------------------------
INSERT INTO products (category_id, name, price, image_url, is_available) VALUES
    (5, 'Souslar',          5000,  'assets/products/snack/01_souslar.png',          TRUE),
    (5, 'Piyozli Halqalar', 15000, 'assets/products/snack/02_piyozli_halqalar.png', TRUE),
    (5, 'Shariki',          15000, 'assets/products/snack/03_shariki.png',          TRUE),
    (5, 'Derevenskiy',      15000, 'assets/products/snack/04_derevenskiy.png',      TRUE),
    (5, 'Fri',              15000, 'assets/products/snack/05_fri.png',              TRUE);

COMMIT;

-- =========================================================================
-- Verification (run manually if needed):
--   SELECT category_id, COUNT(*) FROM products GROUP BY category_id ORDER BY 1;
--   Expected: 1 → 8, 2 → 6, 3 → 6, 4 → 38, 5 → 5  (total = 63)
-- =========================================================================
