# Chef by Birth – Full-Stack Setup Guide

Production-ready Ghanaian food ordering site powered by **Supabase**.

## Project Structure

```
Chefbybirth/
├── index.html              # Customer storefront + cart + checkout
├── admin.html              # Password-protected admin dashboard
├── config.js               # Supabase & business config (edit this!)
├── schema.sql              # Database tables, RLS, seeds
├── vercel.json             # Vercel deploy config
├── netlify.toml            # Netlify deploy config (optional)
├── README.md               # This file
└── supabase/functions/
    ├── order-notification/ # WhatsApp/SMS on new order
    └── update-menu-status/ # Auto-disable out-of-stock items
```

---

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Note your **Project URL** and **anon public key**
3. Go to **Settings → API** and copy the **service_role** key (keep secret!)

---

## Step 2: Run Database Schema

1. Open **SQL Editor** in Supabase Dashboard
2. Paste the entire contents of `schema.sql`
3. Click **Run**
4. Verify tables: `menu_items`, `orders`, `settings`, `order_tracking`

---

## Step 3: Create Admin User

1. Go to **Authentication → Users → Add user**
2. Create:
   - **Email:** `admin@chefbybirth.com`
   - **Password:** `ChefByBirth2025!`
3. **Change this password immediately after first login**

---

## Step 4: Configure Frontend

Edit `config.js`:

```javascript
SUPABASE_URL: 'https://YOUR_PROJECT_REF.supabase.co',
SUPABASE_ANON_KEY: 'your-anon-key-here',
```

Update business phone, WhatsApp, and city placeholders.

---

## Step 5: Deploy Edge Functions (Optional – Twilio notifications)

### Install Supabase CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

### Set secrets

```bash
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set TWILIO_ACCOUNT_SID=your-twilio-sid
supabase secrets set TWILIO_AUTH_TOKEN=your-twilio-token
supabase secrets set TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
supabase secrets set TWILIO_SMS_NUMBER=+15551234567
supabase secrets set YOUR_BUSINESS_PHONE_NUMBER=whatsapp:+15551234567
```

### Deploy functions

```bash
supabase functions deploy order-notification --no-verify-jwt
supabase functions deploy update-menu-status --no-verify-jwt
```

### Create Database Webhooks

**Webhook 1 – New orders**
- Dashboard → **Database → Webhooks → Create**
- Table: `orders` | Events: **INSERT**
- URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/order-notification`
- HTTP Headers: `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`

**Webhook 2 – Menu availability**
- Table: `menu_items` | Events: **UPDATE**
- URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/update-menu-status`
- HTTP Headers: `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`

> Without Twilio, orders still work. Customers get a WhatsApp link after checkout.

---

## Step 6: Deploy Frontend

### Vercel (recommended)

1. Go to [vercel.com/new](https://vercel.com/new) and import **Shugger001/chefbybirth**
2. Use these settings:
   - **Framework Preset:** Other
   - **Build Command:** *(leave empty)*
   - **Output Directory:** `.` *(root)*
3. Click **Deploy**
4. Your site will be at `https://your-project.vercel.app`
5. Admin dashboard: `https://your-project.vercel.app/admin`

Every `git push` to `main` triggers an automatic redeploy on Vercel.

### Netlify

### Local testing

```bash
npx serve .
# Open http://localhost:3000
```

---

## Environment Variables Reference

| Variable | Where Used | Required |
|----------|-----------|----------|
| `SUPABASE_URL` | config.js, edge functions | ✅ |
| `SUPABASE_ANON_KEY` | config.js (frontend) | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge functions only | For notifications |
| `TWILIO_ACCOUNT_SID` | order-notification | Optional |
| `TWILIO_AUTH_TOKEN` | order-notification | Optional |
| `TWILIO_WHATSAPP_NUMBER` | order-notification | Optional |
| `YOUR_BUSINESS_PHONE_NUMBER` | order-notification | Optional |

**Never expose `SUPABASE_SERVICE_ROLE_KEY` in `config.js` or frontend code.**

---

## Features

### Customer (`index.html`)
- Live menu from Supabase (updates without redeploying)
- Shopping cart with quantity controls
- Pickup / delivery toggle ($5 fee, free over $40)
- Business hours validation
- 24-hour notice for 10+ kenkey pieces
- Order stored in database with tracking token
- WhatsApp confirmation link after order
- Realtime menu availability updates
- Order status notifications (when status → ready)

### Admin (`/admin`)
- Supabase Auth login
- Realtime orders table with status filters
- Update order status workflow
- Mark WhatsApp sent
- Menu CRUD + availability toggle
- Settings: hours, delivery fee, radius
- Analytics: today's orders, weekly revenue, popular item

---

## Security Notes

- RLS enabled on all tables
- Public can **INSERT** orders and **SELECT** available menu + settings
- Only authenticated admin can manage orders/menu/settings
- Order tracking uses secure `tracking_token` + RPC
- Change default admin password immediately

---

## Default Admin Login

| Field | Value |
|-------|-------|
| Email | `admin@chefbybirth.com` |
| Password | `ChefByBirth2025!` |

---

## Troubleshooting

**Menu not loading?** Check `config.js` keys and RLS policies in Supabase.

**Orders not inserting?** Open browser DevTools → Network. Verify anon key and INSERT policy.

**Admin can't login?** Confirm user exists in Authentication → Users.

**Realtime not working?** Enable Realtime for `orders`, `menu_items`, `order_tracking` in Database → Replication.

**Edge function not firing?** Verify webhook URL and Authorization header with service role key.

---

© 2025 Chef by Birth – Authentic Ghanaian Food in Pennsylvania
