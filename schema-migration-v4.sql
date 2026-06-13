-- =============================================================================
-- Chef by Birth – Migration v4 (real menu prices & business info)
-- Run in Supabase SQL Editor after schema-migration-v3.sql
-- =============================================================================

-- Retire old placeholder menu items
UPDATE menu_items SET is_available = false, updated_at = NOW()
WHERE name NOT IN (
  '1 Ball of Kenkey',
  'Box of Kenkey (10 balls)',
  'Chofi (6 pieces)',
  'Turkey Wings (6 pieces)',
  'Shito — Small',
  'Shito — Medium',
  'Shito — Large'
);

INSERT INTO menu_items (name, description, price, category, is_available, image_url) VALUES
  ('1 Ball of Kenkey', 'Single ball of traditional fermented kenkey', 5.00, 'kenkey', true, '/assets/hero-kenkey.png'),
  ('Box of Kenkey (10 balls)', 'Full box — 10 balls of fermented kenkey', 50.00, 'kenkey', true, '/assets/menu-kenkey-box.png'),
  ('Chofi (6 pieces)', 'Six pieces of chofi — we don''t do fish', 30.00, 'proteins', true, '/assets/menu-chofi.png'),
  ('Turkey Wings (6 pieces)', 'Six seasoned turkey wings', 30.00, 'proteins', true, '/assets/menu-turkey-wings.png'),
  ('Shito — Small', 'Homemade shito — small size', 30.00, 'shito', true, '/assets/menu-shito.png'),
  ('Shito — Medium', 'Homemade shito — medium size', 50.00, 'shito', true, '/assets/menu-shito.png'),
  ('Shito — Large', 'Homemade shito — large size', 100.00, 'shito', true, '/assets/menu-shito.png')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  category = EXCLUDED.category,
  is_available = EXCLUDED.is_available,
  image_url = EXCLUDED.image_url,
  updated_at = NOW();

INSERT INTO settings (key, value) VALUES
  ('business_phone', '+14843478213'),
  ('business_whatsapp', '14843478213'),
  ('business_email', 'Rhodalineemefa@outlook.com'),
  ('business_city', 'Whitehall, Pennsylvania'),
  ('map_embed_query', 'Whitehall, Pennsylvania'),
  ('payment_cash_app', '$RhodaEmefaAmedeku'),
  ('payment_zelle_name', 'Rhoda Amedeku'),
  ('payment_zelle_email', 'Rhodalineemefa@outlook.com'),
  ('site_announcement', '📦 Shipping fees vary by state. Confirm your order with us before payment!'),
  ('ticker_messages', '["🌽 1 ball $5 · Box of 10 $50","🍗 Chofi & turkey wings — 6 for $30","🌶️ Shito: Small $30 · Medium $50 · Large $100","📍 Based in Whitehall, PA — we ship nationwide"]')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

UPDATE settings SET value = (
  SELECT id::text FROM menu_items WHERE name = 'Box of Kenkey (10 balls)' LIMIT 1
) WHERE key = 'featured_menu_item_id';
