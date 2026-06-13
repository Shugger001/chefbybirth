-- =============================================================================
-- Chef by Birth – Migration v2 (site content settings)
-- Run in Supabase Dashboard → SQL Editor after schema-migration.sql
-- =============================================================================

INSERT INTO settings (key, value) VALUES
  ('site_announcement', '🎉 Welcome! Free shito with every main plate this week.'),
  ('featured_menu_item_id', '1'),
  ('map_embed_query', 'Pennsylvania, USA'),
  ('ticker_messages', '["🔥 Fresh kenkey fermented 3 days","🚚 Free delivery on orders over $40","🌶️ Homemade shito — family recipe","⭐ Try our Classic Kenkey & Fried Fish"]')
ON CONFLICT (key) DO NOTHING;

-- Set default image on menu items missing photos
UPDATE menu_items SET image_url = '/assets/hero-kenkey.png' WHERE image_url IS NULL OR image_url = '';
