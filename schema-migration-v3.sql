-- Menu category rename: main/side/drink → kenkey/proteins/shito/drinks
-- Run in Supabase SQL Editor after schema-migration-v2.sql

ALTER TABLE menu_items DROP CONSTRAINT IF EXISTS menu_items_category_check;

UPDATE menu_items SET category = 'kenkey' WHERE category = 'main';
UPDATE menu_items SET category = 'kenkey' WHERE category = 'side' AND name ILIKE '%kenkey%';
UPDATE menu_items SET category = 'shito' WHERE category = 'side' AND name ILIKE '%shito%';
UPDATE menu_items SET category = 'proteins' WHERE category = 'side';
UPDATE menu_items SET category = 'drinks' WHERE category = 'drink';

ALTER TABLE menu_items ADD CONSTRAINT menu_items_category_check
  CHECK (category IN ('kenkey', 'proteins', 'shito', 'drinks'));
