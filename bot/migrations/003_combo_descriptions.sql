-- =========================================================================
-- Marsexpress24 — Combo Set descriptions (tarkibi)
-- File: bot/migrations/003_combo_descriptions.sql
--
-- Fills products.description for the 38 Combo Set items.
--
-- NOTE: 7 names were reconciled to match the seed data in 002_seed.sql
--       (the source list used different spellings):
--         '1 Combo'          → 'Combo 1'
--         '2 Combo'          → 'Combo 2'
--         'Tan''tana Combo'  → 'Tantana Combo'
--         'Do''star Combo'   → 'Dostar Combo'
--         'Mars Love Burger' → 'Mars Love Burger 1'
--         '1 Ramazan Combo'  → 'Ramazan Combo 1'
--         '2 Ramazan Combo'  → 'Ramazan Combo 2'
--
-- Apostrophes inside text are escaped by doubling ('' = ').
-- =========================================================================

BEGIN;

UPDATE products SET description = 'Lavash Chicken x1, Kartoshka Fri x1, Pepsi 0.5L x1, Iloncha x2, Sous x1' WHERE name = 'Roll Lunch';
UPDATE products SET description = 'Burger Chicken x1, Kartoshka Fri x1, Pepsi 0.5L x1, Iloncha x2, Sous x1' WHERE name = 'Burger Lunch';
UPDATE products SET description = 'Pizza Chicken x1, Kartoshka Fri x1, Pepsi 0.5L x1, Sous x1' WHERE name = 'Combo 6';
UPDATE products SET description = 'Pizza Peperoni x1, Kartoshka Fri x1, Pepsi 0.5L x1, Sous x1' WHERE name = 'Combo 5';
UPDATE products SET description = 'Big Burger x1, Kartoshka Fri x1, Dinay yoki Pepsi 0.5L x1, Qanotcha x3, Sous x1' WHERE name = 'King Mars';
UPDATE products SET description = 'Lavash Chicken x1, Burger Chicken x1, Kartoshka Fri x2, Pepsi 0.5L x2, Iloncha x4, Sous x2' WHERE name = 'Mix Lanch';
UPDATE products SET description = 'Pizza Chicken x1, Pizza Peperoni x1, Kartoshka Fri x1, Pepsi 1L x1, Sous x2' WHERE name = 'Combo 4';
UPDATE products SET description = 'Burger Chicken x4, Kartoshka Fri x4' WHERE name = 'Zero Burger 4';
UPDATE products SET description = 'Lavash Chicken x4, Kartoshka Fri x4' WHERE name = 'Zero Lavash 4';
UPDATE products SET description = 'Pizza Peperoni 25sm x3, Sous x2' WHERE name = 'Peperoni Combo';
UPDATE products SET description = 'Pizza Peperoni 25sm x1, Pizza Chicken 25sm x1, Pizza Margarita 25sm x1, Pepsi 1L x1, Sous x2' WHERE name = 'Combo 1';
UPDATE products SET description = 'Pizza Peperoni 25sm x1, Pizza Chicken 25sm x1, Pizza Margarita 25sm x1, Kartoshka Fri x2, Sous x2' WHERE name = 'Combo 2';
UPDATE products SET description = 'Pizza Peperoni x1, Lavash Chicken x2, Kartoshka Fri x2, Pepsi 1L x1, Sous x2' WHERE name = 'Samarqand Combo';
UPDATE products SET description = 'Burger Chees x2, Kartoshka Fri x2, Pepsi 0.5L x2, Iloncha x4, Sous x2' WHERE name = 'Friends Burger';
UPDATE products SET description = 'Lavash Chees x2, Kartoshka Fri x2, Pepsi 0.5L x2, Iloncha x4, Sous x2' WHERE name = 'Friends Lavash';
UPDATE products SET description = 'Burger King x2, Kartoshka Fri x2, Pepsi 0.5L x2, Qanotcha x4, Sous x2' WHERE name = 'Big Duet';
UPDATE products SET description = 'Pizza Peperoni x2, Pizza Chicken x1, Kartoshka Fri x3, Pepsi 1L x1, Sous x3' WHERE name = 'Tantana Combo';
UPDATE products SET description = 'Pizza Peperoni x1, Pizza Chicken x1, Kartoshka Fri x3, Lavash Chicken x1, Burger Chicken x1, Pepsi 1L x1, Sous x3' WHERE name = 'Student Combo';
UPDATE products SET description = 'Pizza Peperoni x1, Lavash x2, Pepsi 1L x1, Sous x2, Chicken Qanotcha x4' WHERE name = 'Aristokrat Combo';
UPDATE products SET description = 'Pizza Chicken x1, Burger Chicken x2, Kartoshka Fri x3, Pepsi 1L x1, Sous x3, Chicken 0.3kg x1' WHERE name = 'Spice Combo';
UPDATE products SET description = 'Pizza Chicken x1, Lavash Chicken x1, Kartoshka Fri x3, Pepsi 1L x1, Sous x3, Chicken 0.3kg x1' WHERE name = 'Star Combo';
UPDATE products SET description = 'Pizza Peperoni x1, Pizza Chicken x1, Pizza Indeyka x1, Kartoshka Fri x3, Pepsi 1L x1, Sous x3, Chicken 0.3kg x1' WHERE name = 'Dostar Combo';
UPDATE products SET description = 'Burger Chees x3, Kartoshka Fri x3, Pepsi 0.5L x3, Iloncha x3, Qanotcha x3, Sous x3' WHERE name = 'Mars Love Burger 1';
UPDATE products SET description = 'Burger Chees x3, Kartoshka Fri x3, Pepsi 0.5L x3, Iloncha x3, Qanotcha x3, Sous x3' WHERE name = 'Mars Love Burger 2';
UPDATE products SET description = 'Lavash Go''sht x3, Pizza Go''sht x2, Kartoshka Fri x3, Pepsi 1L x1, Sous x3' WHERE name = 'By Raximov Combo';
UPDATE products SET description = 'Burger Chees x4, Kartoshka Fri x4, Pepsi 1L x2, Iloncha x8, Sous x4' WHERE name = 'Oila Burger';
UPDATE products SET description = 'Lavash Chees x4, Kartoshka Fri x4, Pepsi 1L x2, Iloncha x8, Sous x4' WHERE name = 'Oila Lavash';
UPDATE products SET description = 'Burger Chees x2, Lavash Chees x2, Kartoshka Fri x4, Pepsi 1L x2, Iloncha x8, Sous x4' WHERE name = 'Sherif';
UPDATE products SET description = 'Burger King x3, Kartoshka Fri x3, Pepsi 0.5L x3, Qanotcha x6, Sous x3' WHERE name = 'Big Family';
UPDATE products SET description = 'Pizza Peperoni x2, Lavash x2, Kartoshka Fri x4, Pepsi 1L x1, Sous x4, Chicken 0.5kg x1' WHERE name = 'Ramazan Combo 1';
UPDATE products SET description = 'Pizza Chicken x2, Burger Chicken x2, Kartoshka Fri x4, Pepsi 1L x1, Sous x4, Chicken 0.5kg x1' WHERE name = 'Ramazan Combo 2';
UPDATE products SET description = 'Pizza Chicken x1, Pizza Peperoni x1, Burger Chicken x1, Lavash Chicken x1, Kartoshka Fri x4, Pepsi 1L x1, Sous x4, Chicken 0.5kg x1' WHERE name = 'Ramazan Mix Combo';
UPDATE products SET description = 'Burger Chees x5, Kartoshka Fri x5, Pepsi 1L x2, Sous x6, Chicken 1kg x1' WHERE name = 'Lux Burger';
UPDATE products SET description = 'Lavash Chees x5, Kartoshka Fri x5, Pepsi 1L x2, Sous x6, Chicken 1kg x1' WHERE name = 'Lux Lavash';
UPDATE products SET description = 'Pizza Peperoni x2, Burger Chicken x3, Kartoshka Fri x4, Pepsi 1L x2, Sous x4, Chicken 0.5kg x1' WHERE name = 'Legenda Combo';
UPDATE products SET description = 'Pizza Chicken x2, Pizza Peperoni x2, Burger Chicken x2, Lavash Chicken x2, Kartoshka Fri x4, Pepsi 1L x2, Sous x4, Chicken 0.5kg x1' WHERE name = 'Iftar Combo';
UPDATE products SET description = 'Pizza Peperoni x1, Pizza Chicken x1, Pizza Indeyka x1, Pizza Yangilik x1, Kartoshka Fri x4, Pepsi 1L x2, Sous x6, Chicken 0.5kg x1' WHERE name = 'Barakali Combo';
UPDATE products SET description = 'Lavash Go''sht x4, Pizza Go''sht x2, Kartoshka Fri x4, Sous x4, Pepsi 1L x2' WHERE name = 'Amore Combo';

COMMIT;

-- Verification:
--   SELECT COUNT(*) FROM products WHERE category_id = 4 AND description IS NOT NULL;
--   Expected: 38
