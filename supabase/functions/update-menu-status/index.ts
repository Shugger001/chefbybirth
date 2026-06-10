// Supabase Edge Function: update-menu-status
// Called when menu item availability or stock changes.
// Marks items unavailable when stock hits 0 (future-ready).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MenuItemRecord {
  id: number;
  name: string;
  is_available: boolean;
  stock: number | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const payload = await req.json();
    const record: MenuItemRecord = payload.record ?? payload;
    const oldRecord: MenuItemRecord | undefined = payload.old_record;

    if (!record?.id) {
      return new Response(JSON.stringify({ error: 'No menu item record' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let updated = false;

    // Auto-disable when stock reaches 0 (future column)
    if (record.stock !== null && record.stock !== undefined && record.stock <= 0) {
      if (record.is_available) {
        await supabase
          .from('menu_items')
          .update({ is_available: false })
          .eq('id', record.id);
        updated = true;
      }
    }

    // Log availability changes
    if (oldRecord && oldRecord.is_available !== record.is_available) {
      console.error(
        `Menu item "${record.name}" availability: ${oldRecord.is_available} → ${record.is_available}`
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        item_id: record.id,
        is_available: record.is_available,
        auto_disabled: updated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('update-menu-status error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
