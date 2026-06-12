// Supabase Edge Function: order-email
// Sends order confirmation email via Resend API
// Deploy: supabase functions deploy order-email --no-verify-jwt
// Secrets: RESEND_API_KEY, BUSINESS_EMAIL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('BUSINESS_EMAIL') || 'orders@chefbybirth.com';
    const body = await req.json();
    const record = body.record ?? body;

    if (!resendKey) {
      return new Response(JSON.stringify({ skipped: true, reason: 'RESEND_API_KEY not set' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const customerEmail = record.email;
    if (!customerEmail) {
      return new Response(JSON.stringify({ skipped: true, reason: 'No customer email' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const shortId = record.id?.slice(0, 8).toUpperCase();
    const items = (record.order_items || [])
      .map((i: { quantity: number; name: string }) => `${i.quantity}x ${i.name}`)
      .join('\n');

    const body = {
      from: `Chef by Birth <${fromEmail}>`,
      to: [customerEmail],
      subject: `Order Confirmed #${shortId} – Chef by Birth`,
      html: `<h2>Thank you, ${record.customer_name}!</h2>
        <p>Your order <strong>#${shortId}</strong> was received.</p>
        <p><strong>Total:</strong> $${Number(record.total_amount).toFixed(2)}</p>
        <p><strong>Type:</strong> ${record.order_type}</p>
        <pre>${items}</pre>
        <p>We'll confirm via WhatsApp shortly.</p>`,
    };

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return new Response(JSON.stringify({ success: res.ok, status: res.status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('order-email error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
