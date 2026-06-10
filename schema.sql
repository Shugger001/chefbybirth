-- =============================================================================
-- Chef by Birth – Supabase Database Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS menu_items (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  description   TEXT,
  price         DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  category      TEXT NOT NULL CHECK (category IN ('main', 'side', 'drink')),
  is_available  BOOLEAN NOT NULL DEFAULT true,
  image_url     TEXT,
  stock         INTEGER, -- reserved for future use; NULL = unlimited
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_token       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  customer_name        TEXT NOT NULL,
  phone                TEXT NOT NULL,
  email                TEXT,
  order_type           TEXT NOT NULL DEFAULT 'pickup' CHECK (order_type IN ('pickup', 'delivery')),
  delivery_address     TEXT,
  order_items          JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount         DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
  pickup_date          TIMESTAMPTZ NOT NULL,
  special_instructions TEXT,
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'confirmed', 'ready', 'completed', 'cancelled')),
  whatsapp_sent        BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  id         SERIAL PRIMARY KEY,
  key        TEXT NOT NULL UNIQUE,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Denormalized tracking table for secure public order status lookups
CREATE TABLE IF NOT EXISTS order_tracking (
  tracking_token TEXT PRIMARY KEY,
  order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status         TEXT NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_date ON orders(pickup_date);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(is_available);

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_menu_items_updated ON menu_items;
CREATE TRIGGER trg_menu_items_updated
  BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated ON orders;
CREATE TRIGGER trg_orders_updated
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_settings_updated ON settings;
CREATE TRIGGER trg_settings_updated
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- ORDER TRACKING SYNC (for public status polling / realtime)
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_order_tracking()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO order_tracking (tracking_token, order_id, status, updated_at)
  VALUES (NEW.tracking_token, NEW.id, NEW.status, NOW())
  ON CONFLICT (tracking_token) DO UPDATE
    SET status = EXCLUDED.status, updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_orders_sync_tracking ON orders;
CREATE TRIGGER trg_orders_sync_tracking
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION sync_order_tracking();

-- =============================================================================
-- RPC: Secure public order status lookup
-- =============================================================================

CREATE OR REPLACE FUNCTION get_order_status(p_tracking_token TEXT)
RETURNS TABLE (
  order_id       UUID,
  status         TEXT,
  pickup_date    TIMESTAMPTZ,
  customer_name  TEXT,
  total_amount   DECIMAL,
  order_type     TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.status, o.pickup_date, o.customer_name, o.total_amount, o.order_type
  FROM orders o
  WHERE o.tracking_token = p_tracking_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_order_status(TEXT) TO anon, authenticated;

-- =============================================================================
-- RPC: Create order (public – returns id + tracking_token without broad SELECT)
-- =============================================================================

CREATE OR REPLACE FUNCTION create_order(
  p_customer_name        TEXT,
  p_phone                TEXT,
  p_email                TEXT,
  p_order_type           TEXT,
  p_delivery_address     TEXT,
  p_order_items          JSONB,
  p_total_amount         DECIMAL,
  p_pickup_date          TIMESTAMPTZ,
  p_special_instructions TEXT
)
RETURNS TABLE (order_id UUID, tracking_token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id    UUID;
  v_token TEXT;
BEGIN
  IF NOT is_within_business_hours(p_pickup_date) THEN
    RAISE EXCEPTION 'Pickup time is outside business hours';
  END IF;

  INSERT INTO orders (
    customer_name, phone, email, order_type, delivery_address,
    order_items, total_amount, pickup_date, special_instructions, status
  ) VALUES (
    p_customer_name, p_phone, NULLIF(p_email, ''), p_order_type, NULLIF(p_delivery_address, ''),
    p_order_items, p_total_amount, p_pickup_date, NULLIF(p_special_instructions, ''), 'pending'
  )
  RETURNING id, orders.tracking_token INTO v_id, v_token;

  RETURN QUERY SELECT v_id, v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION create_order(TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,DECIMAL,TIMESTAMPTZ,TEXT) TO anon, authenticated;

-- =============================================================================
-- RPC: Business hours validation helper
-- =============================================================================

CREATE OR REPLACE FUNCTION is_within_business_hours(p_pickup TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hours JSONB;
  v_dow INT;
  v_day_key TEXT;
  v_day JSONB;
  v_open TIME;
  v_close TIME;
  v_pickup_time TIME;
BEGIN
  SELECT value::jsonb INTO v_hours FROM settings WHERE key = 'business_hours' LIMIT 1;
  IF v_hours IS NULL THEN RETURN true; END IF;

  -- Convert to America/New_York (Pennsylvania)
  v_dow := EXTRACT(DOW FROM p_pickup AT TIME ZONE 'America/New_York');
  v_day_key := CASE v_dow
    WHEN 0 THEN 'sunday'
    WHEN 1 THEN 'monday'
    WHEN 2 THEN 'tuesday'
    WHEN 3 THEN 'wednesday'
    WHEN 4 THEN 'thursday'
    WHEN 5 THEN 'friday'
    WHEN 6 THEN 'saturday'
  END;

  v_day := v_hours -> v_day_key;
  IF v_day IS NULL OR (v_day ->> 'closed')::boolean IS true THEN
    RETURN false;
  END IF;

  v_open := (v_day ->> 'open')::time;
  v_close := (v_day ->> 'close')::time;
  v_pickup_time := (p_pickup AT TIME ZONE 'America/New_York')::time;

  RETURN v_pickup_time >= v_open AND v_pickup_time < v_close;
END;
$$;

GRANT EXECUTE ON FUNCTION is_within_business_hours(TIMESTAMPTZ) TO anon, authenticated;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_tracking ENABLE ROW LEVEL SECURITY;

-- menu_items: public reads available items only
DROP POLICY IF EXISTS "Public read available menu" ON menu_items;
CREATE POLICY "Public read available menu"
  ON menu_items FOR SELECT
  TO anon, authenticated
  USING (is_available = true);

DROP POLICY IF EXISTS "Admin manage menu" ON menu_items;
CREATE POLICY "Admin manage menu"
  ON menu_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Admin needs to read unavailable items too
DROP POLICY IF EXISTS "Admin read all menu" ON menu_items;
CREATE POLICY "Admin read all menu"
  ON menu_items FOR SELECT
  TO authenticated
  USING (true);

-- orders: public can insert
DROP POLICY IF EXISTS "Public insert orders" ON orders;
CREATE POLICY "Public insert orders"
  ON orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- orders: admin full access
DROP POLICY IF EXISTS "Admin manage orders" ON orders;
CREATE POLICY "Admin manage orders"
  ON orders FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- settings: public read (hours, fees)
DROP POLICY IF EXISTS "Public read settings" ON settings;
CREATE POLICY "Public read settings"
  ON settings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin manage settings" ON settings;
CREATE POLICY "Admin manage settings"
  ON settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- order_tracking: public can read (used for realtime status with row filter)
DROP POLICY IF EXISTS "Public read tracking" ON order_tracking;
CREATE POLICY "Public read tracking"
  ON order_tracking FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Service sync tracking" ON order_tracking;
CREATE POLICY "Service sync tracking"
  ON order_tracking FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- REALTIME
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE order_tracking;

-- =============================================================================
-- SEED: Menu Items
-- =============================================================================

INSERT INTO menu_items (name, description, price, category, is_available) VALUES
  ('Classic Kenkey & Fried Fish', 'Two kenkey balls + whole crispy fried fish + shito + fresh vegetables', 12.99, 'main', true),
  ('Kenkey with Grilled Tilapia', 'Grilled tilapia (Ghanaian spices) + two kenkey + shito + onions & tomatoes', 15.99, 'main', true),
  ('Vegetarian Kenkey Plate', 'Two kenkey + shito + avocado + boiled eggs + fresh salad', 10.99, 'main', true),
  ('Kenkey & Chicken Stew', 'Two kenkey + rich Ghanaian tomato stew with chicken', 13.99, 'main', true),
  ('Extra Kenkey (1 piece)', 'One additional kenkey ball', 2.50, 'side', true),
  ('Shito (2oz)', 'Homemade spicy black pepper sauce', 1.50, 'side', true),
  ('Fried Fish (single)', 'Single crispy fried fish', 5.00, 'side', true),
  ('Grilled Tilapia (whole)', 'Whole grilled tilapia with Ghanaian spices', 8.00, 'side', true),
  ('Boiled Eggs (2)', 'Two boiled eggs', 2.00, 'side', true),
  ('Sobolo (Hibiscus)', 'Traditional hibiscus drink', 3.50, 'drink', true),
  ('Asana (Millet)', 'Fermented millet drink', 3.50, 'drink', true),
  ('Malta Guinness', 'Malta Guinness bottled drink', 3.00, 'drink', true),
  ('Canned Soda', 'Assorted canned soda', 1.50, 'drink', true)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- SEED: Settings
-- =============================================================================

INSERT INTO settings (key, value) VALUES
  ('business_hours', '{
    "monday":    {"closed": true},
    "tuesday":   {"open": "12:00", "close": "19:00", "closed": false},
    "wednesday": {"open": "12:00", "close": "19:00", "closed": false},
    "thursday":  {"open": "12:00", "close": "19:00", "closed": false},
    "friday":    {"open": "12:00", "close": "20:00", "closed": false},
    "saturday":  {"open": "12:00", "close": "20:00", "closed": false},
    "sunday":    {"open": "13:00", "close": "17:00", "closed": false}
  }'),
  ('delivery_radius_miles', '20'),
  ('delivery_fee', '5.00'),
  ('free_delivery_threshold', '40.00'),
  ('business_phone', '+15551234567'),
  ('business_whatsapp', '15551234567'),
  ('business_email', 'hello@chefbybirth.com'),
  ('business_city', '[CITY], PA')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- DATABASE WEBHOOK (configure in Supabase Dashboard after deploying edge functions)
-- =============================================================================
-- 1. Deploy: supabase functions deploy order-notification
-- 2. Dashboard → Database → Webhooks → Create webhook
--    Table: orders | Events: INSERT | URL: your-project/functions/v1/order-notification
--    HTTP Headers: Authorization: Bearer YOUR_SERVICE_ROLE_KEY
