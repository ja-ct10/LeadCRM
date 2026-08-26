# Stripe Integration Setup Guide

This guide covers end-to-end Stripe configuration for LeadCRM — from test keys to production webhooks.

## Architecture Overview

LeadCRM uses **Stripe Checkout (redirect)** for subscription purchases and **Stripe Customer Portal** for payment method management. All Stripe API calls happen server-side — the frontend never touches the Stripe SDK directly.

```
Tenant clicks "Upgrade" → Frontend calls backend → Backend creates Checkout Session → Frontend redirects to Stripe
Stripe collects payment → Webhook fires → Backend activates subscription → Tenant sees active plan
```

## Prerequisites

- A [Stripe account](https://dashboard.stripe.com/register) (test mode is fine for development)
- [Stripe CLI](https://stripe.com/docs/stripe-cli) installed for local webhook forwarding
- Backend running on port 4000, frontend on port 3000

---

## Step 1: Get API Keys

1. Go to [Stripe Dashboard → Developers → API Keys](https://dashboard.stripe.com/test/apikeys)
2. Copy the **Secret key** (`sk_test_...`) and **Publishable key** (`pk_test_...`)

## Step 2: Configure Environment Variables

### Local Development (`backend/.env`)

```env
STRIPE_SECRET_KEY="sk_test_your_actual_key_here"
STRIPE_PUBLISHABLE_KEY="pk_test_your_actual_key_here"
STRIPE_WEBHOOK_SECRET="whsec_..."  # From Step 4
FRONTEND_URL="http://localhost:3000"
```

### Production (Render Dashboard)

Add these environment variables to your Render backend service:

| Variable | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` (or `sk_test_...` for staging) |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_...` (or `pk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (from Step 5) |
| `FRONTEND_URL` | `https://your-app.vercel.app` |

## Step 3: Set Up Webhook (Local Development)

Install the Stripe CLI and start forwarding:

```bash
# Install Stripe CLI (one-time)
# Windows (scoop): scoop install stripe
# macOS (brew): brew install stripe/stripe-cli/stripe
# Or download from: https://stripe.com/docs/stripe-cli

# Login to Stripe
stripe login

# Start webhook forwarding (run in a separate terminal)
npm run stripe:listen
# Or directly:
stripe listen --forward-to localhost:4000/api/v1/webhooks/stripe
```

The CLI will print a webhook signing secret (`whsec_...`). Copy it to your `backend/.env` as `STRIPE_WEBHOOK_SECRET`.

## Step 4: Set Up Webhook (Production)

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click **Add endpoint**
3. Endpoint URL: `https://your-backend.onrender.com/api/v1/webhooks/stripe`
4. Select these events:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `charge.refunded`
   - `payment_intent.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** → add to Render as `STRIPE_WEBHOOK_SECRET`

## Step 5: Configure Customer Portal

1. Go to [Stripe Dashboard → Settings → Billing → Customer Portal](https://dashboard.stripe.com/test/settings/billing/portal)
2. Enable:
   - **Payment methods**: Allow customers to update their payment methods
   - **Invoice history**: Show invoice history
3. Optional: Enable **Cancel subscriptions** if you want Stripe to handle cancellation UI
4. Save changes

## Step 6: Sync Pricing Plans to Stripe

Your PricingPlan records in the database need corresponding Stripe Products and Prices.

### Option A: Sync from LeadCRM (recommended)

Call the admin sync endpoint (requires System Admin authentication):

```bash
# Sync all active plans to Stripe
curl -X POST https://your-backend.onrender.com/api/v1/admin/billing/plans/sync-all \
  -H "Cookie: leadcrm_token=YOUR_JWT_COOKIE" \
  -H "Content-Type: application/json"
```

Or from the System Admin billing dashboard UI (when available).

### Option B: Create manually in Stripe Dashboard

1. Go to [Products](https://dashboard.stripe.com/test/products)
2. Create a product for each plan (Free, Pro, Enterprise)
3. Add recurring prices for Monthly, Quarterly, Annual
4. Copy the Product IDs and Price IDs back to your PricingPlan records in the database

## Step 7: Test the Flow

1. Start the backend and frontend: `npm run dev`
2. Start Stripe webhook forwarding: `npm run stripe:listen`
3. Navigate to `/billing/client` in the app
4. Click **Upgrade Plan** → select a plan → proceed to checkout
5. Use Stripe test card: `4242 4242 4242 4242` (any future expiry, any CVC)
6. Complete payment → verify redirect back to billing page
7. Check the terminal running `stripe listen` — you should see webhook events being forwarded
8. Verify in the database: Subscription record created, Tenant plan updated

## Test Cards

| Card Number | Scenario |
|---|---|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 3220` | Requires 3D Secure authentication |
| `4000 0000 0000 9995` | Always declined |
| `4000 0000 0000 0341` | Attaches but fails on first charge |

Use any future expiry date (e.g., 12/34) and any 3-digit CVC.

## Endpoints Reference

### Tenant-Facing (requires auth + tenant)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/billing/subscription` | `billing.view` | Current subscription + plan details |
| GET | `/billing/plans` | `billing.view` | All available pricing plans |
| POST | `/billing/subscription/checkout` | `billing.manage` | Create Stripe Checkout session |
| PATCH | `/billing/subscription/cancel` | `billing.manage` | Cancel at period end |
| POST | `/billing/portal-session` | `billing.manage` | Stripe Customer Portal session |

### System Admin (requires auth + System Admin role)

| Method | Path | Description |
|---|---|---|
| GET | `/admin/billing/metrics` | Revenue dashboard metrics |
| GET | `/admin/billing/payments` | All payment transactions |
| GET | `/admin/billing/subscriptions` | All subscriptions |
| PATCH | `/admin/billing/subscriptions/:id/cancel` | Force-cancel a subscription |
| GET | `/admin/billing/refunds` | Refundable payments |
| POST | `/admin/billing/refunds` | Initiate a refund |
| POST | `/admin/billing/plans/sync-all` | Sync all plans to Stripe |
| POST | `/admin/billing/plans/:id/sync` | Sync one plan to Stripe |
| POST | `/admin/billing/checkout` | Create checkout for a specific tenant |

### Webhook (public, no auth)

| Method | Path | Description |
|---|---|---|
| POST | `/webhooks/stripe` | Stripe webhook handler (raw body, signature verified) |

## Troubleshooting

### "Stripe is not configured" error
Your `STRIPE_SECRET_KEY` is missing or still a placeholder. Add a real key to `backend/.env`.

### Webhook signature verification failed
- Local: make sure `STRIPE_WEBHOOK_SECRET` matches what `stripe listen` printed
- Production: make sure you copied the signing secret from the correct webhook endpoint

### Checkout redirects but subscription isn't activated
The webhook isn't reaching your backend. Check:
1. Is `stripe listen` running (local) or is the webhook endpoint configured (production)?
2. Is the webhook secret correct?
3. Check backend logs for `[Stripe Webhook]` messages

### Customer Portal returns 400
The Customer Portal isn't configured yet. Go to Stripe Dashboard → Settings → Billing → Customer Portal and enable it.

### Plans don't show in the modal
Run the plan sync: `POST /api/v1/admin/billing/plans/sync-all`. Make sure PricingPlan records exist in the database with `isActive: true`.
