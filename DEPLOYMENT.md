# aartisanz Supplier Portal — Complete Deployment Guide

## What you're deploying
- **Frontend**: React app → Vercel (portal.aartisanz.com)
- **Database + Auth**: Supabase
- **Backend**: Supabase Edge Functions (serverless)
- **Integrations**: Shopify API + WhatsApp Business API

---

## STEP 1 — Set up Supabase

1. Go to https://supabase.com and create a free account
2. Click "New Project"
   - Name: `aartisanz-portal`
   - Database password: (save this somewhere safe)
   - Region: Southeast Asia (Singapore) — closest to India
3. Wait ~2 minutes for project to be created

4. Go to **SQL Editor** (left sidebar)
5. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
6. Paste it and click **Run**
7. You should see "Success. No rows returned"

8. Get your credentials:
   - Go to **Settings → API**
   - Copy **Project URL** (looks like: https://xxxx.supabase.co)
   - Copy **anon public key**
   - Copy **service_role key** (keep this secret!)

---

## STEP 2 — Create Admin User in Supabase

1. Go to **Authentication → Users → Add User**
2. Email: `admin@aartisanz.com`
3. Password: (choose a strong password)
4. Click Create User

5. Go to **SQL Editor** and run:
```sql
UPDATE profiles SET role = 'admin', full_name = 'Admin' 
WHERE email = 'admin@aartisanz.com';
```

---

## STEP 3 — Set up Shopify API Access

1. Go to Shopify Admin → **Settings → Apps → Develop apps**
2. Click **Create an app**
   - App name: `Inventory Portal`
3. Click **Configure Admin API scopes**
4. Enable these scopes:
   - `read_products`, `write_products`
   - `read_inventory`, `write_inventory`
   - `read_orders`, `write_orders`
   - `read_locations`
5. Click Save → **Install app**
6. Copy the **Admin API access token** (shown once!)

7. Set up webhook for orders:
   - Go to **Settings → Notifications → Webhooks**
   - Add webhook: Event = `Order creation`
   - URL = `https://xxxx.supabase.co/functions/v1/shopify-webhook`
   - Format: JSON
   - Copy the **webhook signing secret**

---

## STEP 4 — Deploy Supabase Edge Functions

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Login:
```bash
supabase login
```

3. Link to your project:
```bash
supabase link --project-ref YOUR_PROJECT_REF
```
(Project ref is in Settings → General, looks like: abcdefghijkl)

4. Set environment secrets:
```bash
supabase secrets set SHOPIFY_STORE_URL=aartisanz.myshopify.com
supabase secrets set SHOPIFY_ACCESS_TOKEN=your_shopify_access_token
supabase secrets set SHOPIFY_WEBHOOK_SECRET=your_webhook_secret
supabase secrets set WHATSAPP_API_TOKEN=your_whatsapp_token
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
supabase secrets set ADMIN_WHATSAPP_NUMBER=919376933769
```

5. Deploy all edge functions:
```bash
supabase functions deploy shopify-sync
supabase functions deploy shopify-webhook
supabase functions deploy whatsapp-notify
supabase functions deploy create-supplier
```

---

## STEP 5 — Set up Frontend

1. Create `.env` file in project root:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

2. Test locally:
```bash
npm install
npm run dev
```
Open http://localhost:5173 and test login with admin@aartisanz.com

---

## STEP 6 — Deploy to Vercel

### Option A — Vercel Dashboard (easiest)

1. Push your code to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/aartisanz-portal.git
git push -u origin main
```

2. Go to https://vercel.com → Sign up with GitHub
3. Click **New Project** → Import your `aartisanz-portal` repo
4. Add environment variables:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
5. Click **Deploy**
6. Vercel gives you a URL like `aartisanz-portal.vercel.app`

### Option B — Custom Domain (portal.aartisanz.com)

1. In Vercel project → **Settings → Domains**
2. Add `portal.aartisanz.com`
3. Go to your domain registrar → Add CNAME record:
   - Name: `portal`
   - Value: `cname.vercel-dns.com`

---

## STEP 7 — WhatsApp Business API Setup

1. Go to https://developers.facebook.com
2. Create a Meta Developer account
3. Create a new app → Business type
4. Add **WhatsApp** product
5. Get a test phone number OR add your WhatsApp Business number
6. Get:
   - **Phone Number ID**
   - **Permanent Access Token** (from System Users in Meta Business)
7. Add these to Supabase secrets (Step 4)

---

## STEP 8 — Verify Everything Works

### Test checklist:
- [ ] Login as admin at portal.aartisanz.com
- [ ] Add a supplier from admin panel
- [ ] Login as supplier with new credentials
- [ ] Add a product as supplier
- [ ] Approve product as admin — should appear on Shopify
- [ ] Place test order on Shopify — should appear in portal
- [ ] Supplier gets WhatsApp notification
- [ ] Mark order as fulfilled — admin gets notification

---

## Architecture Summary

```
Customer visits aartisanz.myshopify.com
         ↓ places order
Shopify webhook fires
         ↓
Supabase Edge Function (shopify-webhook)
         ↓ creates order record
Supabase Database (orders table)
         ↓ triggers
WhatsApp notification to supplier
         ↓
Supplier logs into portal.aartisanz.com
         ↓ updates stock / marks shipped
Supabase Edge Function (shopify-sync)
         ↓
Shopify inventory updated automatically
```

---

## Important URLs

| Service | URL |
|---------|-----|
| Supplier Portal | https://portal.aartisanz.com |
| Supabase Dashboard | https://supabase.com/dashboard |
| Vercel Dashboard | https://vercel.com/dashboard |
| Shopify Admin | https://admin.shopify.com/store/aartisanz |
| Meta Developer | https://developers.facebook.com |

---

## Need help?

Contact your developer or Claude with any error messages!
