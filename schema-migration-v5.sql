-- Menu item images
-- Run in Supabase SQL Editor after schema-migration-v4.sql

UPDATE menu_items SET image_url = '/assets/hero-kenkey.png', updated_at = NOW()
WHERE name = '1 Ball of Kenkey';

UPDATE menu_items SET image_url = '/assets/menu-kenkey-box.png', updated_at = NOW()
WHERE name = 'Box of Kenkey (10 balls)';

UPDATE menu_items SET image_url = '/assets/menu-chofi.png', updated_at = NOW()
WHERE name = 'Chofi (6 pieces)';

UPDATE menu_items SET image_url = '/assets/menu-turkey-wings.png', updated_at = NOW()
WHERE name = 'Turkey Wings (6 pieces)';

UPDATE menu_items SET image_url = '/assets/menu-shito.png', updated_at = NOW()
WHERE name IN ('Shito — Small', 'Shito — Medium', 'Shito — Large');
