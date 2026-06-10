// Supabase Edge Function: order-notification
// Sends WhatsApp + SMS when a new order is inserted.
// Deploy: supabase functions deploy order-notification --no-verify-jwt
// Trigger via Database Webhook on orders INSERT

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderRecord {
  id: string;
  tracking_token: string;
  customer_name: string;
  phone: string;
  email?: string;
  order_type: string;
  delivery_address?: string;
  order_items: Array<{ name: string; quantity: number; price: number }>;
  total_amount: number;
  pickup_date: string;
  special_instructions?: string;
  status: string;
}

function formatOrderItems(items: OrderRecord['order_items']): string {
  return items
    .map((i) => `• ${i.quantity}x ${i.name} ($${Number(i.price).toFixed(2)})`)
    .join('\n');
}

async function sendTwilioMessage(
  accountSid: string,
  authToken: string,
  from: string,
  to: string,
  body: string
): Promise<Response> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({ From: from, To: to, Body: body });

  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${accountSid}:${authToken}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.startsWith('1') && digits.length === 11) return `+${digits}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioWhatsApp = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
    const businessPhone = Deno.env.get('YOUR_BUSINESS_PHONE_NUMBER');

    const supabase = createClient(supabaseUrl, serviceKey);

    const payload = await req.json();
    const record: OrderRecord = payload.record ?? payload;

    if (!record?.id) {
      return new Response(JSON.stringify({ error: 'No order record provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pickupFormatted = new Date(record.pickup_date).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    const itemsText = formatOrderItems(record.order_items ?? []);
    const orderLabel = record.id.slice(0, 8).toUpperCase();

    const businessMessage =
      `🍽️ NEW ORDER #${orderLabel}\n\n` +
      `👤 ${record.customer_name}\n` +
      `📱 ${record.phone}\n` +
      (record.email ? `📧 ${record.email}\n` : '') +
      `📦 ${record.order_type === 'delivery' ? 'Delivery' : 'Pickup'}\n` +
      (record.delivery_address ? `📍 ${record.delivery_address}\n` : '') +
      `\n${itemsText}\n\n` +
      `💰 Total: $${Number(record.total_amount).toFixed(2)}\n` +
      `🕐 ${pickupFormatted}\n` +
      (record.special_instructions ? `\n📝 ${record.special_instructions}` : '');

    const customerMessage =
      `Hi ${record.customer_name}! Your Chef by Birth order #${orderLabel} was received.\n` +
      `Total: $${Number(record.total_amount).toFixed(2)}\n` +
      `${record.order_type === 'delivery' ? 'Delivery' : 'Pickup'}: ${pickupFormatted}\n` +
      `We'll confirm via WhatsApp shortly.`;

    const results: Record<string, string> = { order_id: record.id };

    if (twilioSid && twilioToken && twilioWhatsApp && businessPhone) {
      const bizWhatsAppTo = businessPhone.startsWith('whatsapp:')
        ? businessPhone
        : `whatsapp:${normalizePhone(businessPhone)}`;

      const waRes = await sendTwilioMessage(
        twilioSid,
        twilioToken,
        twilioWhatsApp,
        bizWhatsAppTo,
        businessMessage
      );
      results.business_whatsapp = waRes.ok ? 'sent' : 'failed';

      const customerPhone = normalizePhone(record.phone);
      const custWhatsAppTo = `whatsapp:${customerPhone}`;
      const custWaRes = await sendTwilioMessage(
        twilioSid,
        twilioToken,
        twilioWhatsApp,
        custWhatsAppTo,
        customerMessage
      );
      results.customer_whatsapp = custWaRes.ok ? 'sent' : 'failed';

      const smsFrom = Deno.env.get('TWILIO_SMS_NUMBER');
      if (smsFrom) {
        const smsRes = await sendTwilioMessage(
          twilioSid,
          twilioToken,
          smsFrom,
          customerPhone,
          customerMessage
        );
        results.customer_sms = smsRes.ok ? 'sent' : 'failed';
      }
    } else {
      results.notification = 'skipped – Twilio env vars not configured';
    }

    await supabase
      .from('orders')
      .update({ whatsapp_sent: true })
      .eq('id', record.id);

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('order-notification error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
