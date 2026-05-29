-- =========================================================================
-- Marsexpress24 — Combo Set ingredient descriptions
-- File: bot/migrations/003_combo_descriptions.sql
--
-- Sets the `description` for every Combo Set product (category_id = 4).
-- Format: "<item> <N> ta" comma-separated; the Mini App splits on commas
-- and renders each as a bullet line.
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
-- =========================================================================

BEGIN;

UPDATE products SET description = 'Lavash Chicken 1 ta, Kartoshka Fri 1 ta, Pepsi 0.5L 1 ta, Iloncha 2 ta, Sous 1 ta' WHERE name = 'Roll Lunch';
UPDATE products SET description = 'Burger Chicken 1 ta, Kartoshka Fri 1 ta, Pepsi 0.5L 1 ta, Iloncha 2 ta, Sous 1 ta' WHERE name = 'Burger Lunch';
UPDATE products SET description = 'Pizza Chicken 1 ta, Kartoshka Fri 1 ta, Pepsi 0.5L 1 ta, Sous 1 ta' WHERE name = 'Combo 6';
UPDATE products SET description = 'Pizza Peperoni 1 ta, Kartoshka Fri 1 ta, Pepsi 0.5L 1 ta, Sous 1 ta' WHERE name = 'Combo 5';
UPDATE products SET description = 'Big Burger 1 ta, Kartoshka Fri 1 ta, Dinay yoki Pepsi 0.5L 1 ta, Qanotcha 3 ta, Sous 1 ta' WHERE name = 'King Mars';
UPDATE products SET description = 'Lavash Chicken 1 ta, Burger Chicken 1 ta, Kartoshka Fri 2 ta, Pepsi 0.5L 2 ta, Iloncha 4 ta, Sous 2 ta' WHERE name = 'Mix Lanch';
UPDATE products SET description = 'Pizza Chicken 1 ta, Pizza Peperoni 1 ta, Kartoshka Fri 1 ta, Pepsi 1L 1 ta, Sous 2 ta' WHERE name = 'Combo 4';
UPDATE products SET description = 'Burger Chicken 4 ta, Kartoshka Fri 4 ta' WHERE name = 'Zero Burger 4';
UPDATE products SET description = 'Lavash Chicken 4 ta, Kartoshka Fri 4 ta' WHERE name = 'Zero Lavash 4';
UPDATE products SET description = 'Pizza Peperoni 25sm 3 ta, Sous 2 ta' WHERE name = 'Peperoni Combo';
UPDATE products SET description = 'Pizza Peperoni 25sm 1 ta, Pizza Chicken 25sm 1 ta, Pizza Margarita 25sm 1 ta, Pepsi 1L 1 ta, Sous 2 ta' WHERE name = 'Combo 1';
UPDATE products SET description = 'Pizza Peperoni 25sm 1 ta, Pizza Chicken 25sm 1 ta, Pizza Margarita 25sm 1 ta, Kartoshka Fri 2 ta, Sous 2 ta' WHERE name = 'Combo 2';
UPDATE products SET description = 'Pizza Peperoni 1 ta, Lavash Chicken 2 ta, Kartoshka Fri 2 ta, Pepsi 1L 1 ta, Sous 2 ta' WHERE name = 'Samarqand Combo';
UPDATE products SET description = 'Burger Chees 2 ta, Kartoshka Fri 2 ta, Pepsi 0.5L 2 ta, Iloncha 4 ta, Sous 2 ta' WHERE name = 'Friends Burger';
UPDATE products SET description = 'Lavash Chees 2 ta, Kartoshka Fri 2 ta, Pepsi 0.5L 2 ta, Iloncha 4 ta, Sous 2 ta' WHERE name = 'Friends Lavash';
UPDATE products SET description = 'Burger King 2 ta, Kartoshka Fri 2 ta, Pepsi 0.5L 2 ta, Qanotcha 4 ta, Sous 2 ta' WHERE name = 'Big Duet';
UPDATE products SET description = 'Pizza Peperoni 2 ta, Pizza Chicken 1 ta, Kartoshka Fri 3 ta, Pepsi 1L 1 ta, Sous 3 ta' WHERE name = 'Tantana Combo';
UPDATE products SET description = 'Pizza Peperoni 1 ta, Pizza Chicken 1 ta, Kartoshka Fri 3 ta, Lavash Chicken 1 ta, Burger Chicken 1 ta, Pepsi 1L 1 ta, Sous 3 ta' WHERE name = 'Student Combo';
UPDATE products SET description = 'Pizza Peperoni 1 ta, Lavash 2 ta, Pepsi 1L 1 ta, Sous 2 ta, Chicken Qanotcha 4 ta' WHERE name = 'Aristokrat Combo';
UPDATE products SET description = 'Pizza Chicken 1 ta, Burger Chicken 2 ta, Kartoshka Fri 3 ta, Pepsi 1L 1 ta, Sous 3 ta, Chicken 0.3kg 1 ta' WHERE name = 'Spice Combo';
UPDATE products SET description = 'Pizza Chicken 1 ta, Lavash Chicken 1 ta, Kartoshka Fri 3 ta, Pepsi 1L 1 ta, Sous 3 ta, Chicken 0.3kg 1 ta' WHERE name = 'Star Combo';
UPDATE products SET description = 'Pizza Peperoni 1 ta, Pizza Chicken 1 ta, Pizza Indeyka 1 ta, Kartoshka Fri 3 ta, Pepsi 1L 1 ta, Sous 3 ta, Chicken 0.3kg 1 ta' WHERE name = 'Dostar Combo';
UPDATE products SET description = 'Burger Chees 3 ta, Kartoshka Fri 3 ta, Pepsi 0.5L 3 ta, Iloncha 3 ta, Qanotcha 3 ta, Sous 3 ta' WHERE name = 'Mars Love Burger 1';
UPDATE products SET description = 'Burger Chees 3 ta, Kartoshka Fri 3 ta, Pepsi 0.5L 3 ta, Iloncha 3 ta, Qanotcha 3 ta, Sous 3 ta' WHERE name = 'Mars Love Burger 2';
UPDATE products SET description = 'Lavash Go''sht 3 ta, Pizza Go''sht 2 ta, Kartoshka Fri 3 ta, Pepsi 1L 1 ta, Sous 3 ta' WHERE name = 'By Raximov Combo';
UPDATE products SET description = 'Burger Chees 4 ta, Kartoshka Fri 4 ta, Pepsi 1L 2 ta, Iloncha 8 ta, Sous 4 ta' WHERE name = 'Oila Burger';
UPDATE products SET description = 'Lavash Chees 4 ta, Kartoshka Fri 4 ta, Pepsi 1L 2 ta, Iloncha 8 ta, Sous 4 ta' WHERE name = 'Oila Lavash';
UPDATE products SET description = 'Burger Chees 2 ta, Lavash Chees 2 ta, Kartoshka Fri 4 ta, Pepsi 1L 2 ta, Iloncha 8 ta, Sous 4 ta' WHERE name = 'Sherif';
UPDATE products SET description = 'Burger King 3 ta, Kartoshka Fri 3 ta, Pepsi 0.5L 3 ta, Qanotcha 6 ta, Sous 3 ta' WHERE name = 'Big Family';
UPDATE products SET description = 'Pizza Peperoni 2 ta, Lavash 2 ta, Kartoshka Fri 4 ta, Pepsi 1L 1 ta, Sous 4 ta, Chicken 0.5kg 1 ta' WHERE name = 'Ramazan Combo 1';
UPDATE products SET description = 'Pizza Chicken 2 ta, Burger Chicken 2 ta, Kartoshka Fri 4 ta, Pepsi 1L 1 ta, Sous 4 ta, Chicken 0.5kg 1 ta' WHERE name = 'Ramazan Combo 2';
UPDATE products SET description = 'Pizza Chicken 1 ta, Pizza Peperoni 1 ta, Burger Chicken 1 ta, Lavash Chicken 1 ta, Kartoshka Fri 4 ta, Pepsi 1L 1 ta, Sous 4 ta, Chicken 0.5kg 1 ta' WHERE name = 'Ramazan Mix Combo';
UPDATE products SET description = 'Burger Chees 5 ta, Kartoshka Fri 5 ta, Pepsi 1L 2 ta, Sous 6 ta, Chicken 1kg 1 ta' WHERE name = 'Lux Burger';
UPDATE products SET description = 'Lavash Chees 5 ta, Kartoshka Fri 5 ta, Pepsi 1L 2 ta, Sous 6 ta, Chicken 1kg 1 ta' WHERE name = 'Lux Lavash';
UPDATE products SET description = 'Pizza Peperoni 2 ta, Burger Chicken 3 ta, Kartoshka Fri 4 ta, Pepsi 1L 2 ta, Sous 4 ta, Chicken 0.5kg 1 ta' WHERE name = 'Legenda Combo';
UPDATE products SET description = 'Pizza Chicken 2 ta, Pizza Peperoni 2 ta, Burger Chicken 2 ta, Lavash Chicken 2 ta, Kartoshka Fri 4 ta, Pepsi 1L 2 ta, Sous 4 ta, Chicken 0.5kg 1 ta' WHERE name = 'Iftar Combo';
UPDATE products SET description = 'Pizza Peperoni 1 ta, Pizza Chicken 1 ta, Pizza Indeyka 1 ta, Pizza Yangilik 1 ta, Kartoshka Fri 4 ta, Pepsi 1L 2 ta, Sous 6 ta, Chicken 0.5kg 1 ta' WHERE name = 'Barakali Combo';
UPDATE products SET description = 'Lavash Go''sht 4 ta, Pizza Go''sht 2 ta, Kartoshka Fri 4 ta, Sous 4 ta, Pepsi 1L 2 ta' WHERE name = 'Amore Combo';

COMMIT;
