/**
 * Chef by Birth – Environment Configuration
 * Replace placeholder values with your Supabase & Twilio credentials.
 * NEVER commit real service_role keys to public repos.
 */
const CONFIG = {
  // Supabase (required)
  SUPABASE_URL: 'https://gjmndsgkydensiqxuwgo.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqbW5kc2dreWRlbnNpcXh1d2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMTc0OTMsImV4cCI6MjA5NjY5MzQ5M30.H4tnWCHDsIy4z5L6DZzaBjWvtiwpper5J053-9A9_xY',

  // Used only in edge functions / server-side – not exposed in frontend
  // Listed here for reference; do NOT put service role key in client code
  SUPABASE_SERVICE_ROLE_KEY: 'YOUR_SUPABASE_SERVICE_ROLE_KEY',

  // Twilio WhatsApp / SMS (edge functions only)
  TWILIO_ACCOUNT_SID: 'YOUR_TWILIO_ACCOUNT_SID',
  TWILIO_AUTH_TOKEN: 'YOUR_TWILIO_AUTH_TOKEN',
  TWILIO_WHATSAPP_NUMBER: 'whatsapp:+14155238886',
  TWILIO_SMS_NUMBER: '+15551234567',

  // Business contact (frontend fallbacks before settings load)
  BUSINESS_NAME: 'Chef by Birth',
  BUSINESS_PHONE: '(555) 123-4567',
  BUSINESS_PHONE_TEL: '+15551234567',
  BUSINESS_WHATSAPP: '15551234567',
  BUSINESS_EMAIL: 'hello@chefbybirth.com',
  BUSINESS_CITY: '[CITY], PA',
  BUSINESS_INSTAGRAM: 'chefbybirth',

  // Admin route
  ADMIN_PATH: '/admin.html',

  // Defaults (overridden by settings table when loaded)
  DELIVERY_FEE: 5.0,
  FREE_DELIVERY_THRESHOLD: 40.0,
  KENKEY_LARGE_ORDER_MIN: 10,
};

// Export for module environments; attach to window for browser scripts
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
