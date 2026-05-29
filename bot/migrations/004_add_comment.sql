-- =========================================================================
-- Marsexpress24 — add optional order comment
-- File: bot/migrations/004_add_comment.sql
--
-- The Mini App checkout collects an optional free-text comment. Until now
-- it was only forwarded to the admin receipt; this column persists it so
-- it can also be shown in the customer's order history.
-- =========================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS comment TEXT;
