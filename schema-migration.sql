-- =============================================================================
-- Chef by Birth – Migration (run if you already executed schema.sql)
-- Supabase Dashboard → SQL Editor → Run this file
-- =============================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS spice_level TEXT DEFAULT 'medium';

-- Update get_order_status to include spice_level
CREATE OR REPLACE FUNCTION get_order_status(p_tracking_token TEXT)
RETURNS TABLE (
  order_id       UUID,
  status         TEXT,
  pickup_date    TIMESTAMPTZ,
  customer_name  TEXT,
  total_amount   DECIMAL,
  order_type     TEXT,
  spice_level    TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.status, o.pickup_date, o.customer_name, o.total_amount, o.order_type, o.spice_level
  FROM orders o
  WHERE o.tracking_token = p_tracking_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_order_status(TEXT) TO anon, authenticated;

-- Replace create_order with spice_level support
DROP FUNCTION IF EXISTS create_order(TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,DECIMAL,TIMESTAMPTZ,TEXT);

CREATE OR REPLACE FUNCTION create_order(
  p_customer_name        TEXT,
  p_phone                TEXT,
  p_email                TEXT,
  p_order_type           TEXT,
  p_delivery_address     TEXT,
  p_order_items          JSONB,
  p_total_amount         DECIMAL,
  p_pickup_date          TIMESTAMPTZ,
  p_special_instructions TEXT,
  p_spice_level          TEXT DEFAULT 'medium'
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
    order_items, total_amount, pickup_date, special_instructions, spice_level, status
  ) VALUES (
    p_customer_name, p_phone, NULLIF(p_email, ''), p_order_type, NULLIF(p_delivery_address, ''),
    p_order_items, p_total_amount, p_pickup_date, NULLIF(p_special_instructions, ''), COALESCE(p_spice_level, 'medium'), 'pending'
  )
  RETURNING id, orders.tracking_token INTO v_id, v_token;

  RETURN QUERY SELECT v_id, v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION create_order(TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,DECIMAL,TIMESTAMPTZ,TEXT,TEXT) TO anon, authenticated;

INSERT INTO settings (key, value) VALUES
  ('delivery_zip_prefixes', '["190","191","193","194","170","171","172","173","174","175","176","177","178","179","180","181","182","183","184","185","186","187","188","189","195","196"]'),
  ('instagram_handle', 'chefbybirth'),
  ('instagram_url', 'https://instagram.com/chefbybirth'),
  ('site_url', 'https://chefbybirth.vercel.app')
ON CONFLICT (key) DO NOTHING;
