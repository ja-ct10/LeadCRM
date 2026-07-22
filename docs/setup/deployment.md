# LeadCRM — Vercel + Supabase Deployment Guide

A step-by-step guide to deploying **LeadCRM** using **Vercel** (for the Next.js Frontend), **Supabase** (for the PostgreSQL Database), and **Render / Railway** (for the Express.js Backend API).

---

## 🎯 Architecture Overview

```
                                +-----------------------------------+
                                |         Vercel (Frontend)         |
                                |     https://your-app.vercel.app   |
                                +-----------------------------------+
                                                  |
                                   HTTP REST API Requests (CORS Scoped)
                                                  |
                                                  v
                                +-----------------------------------+
                                |   Render / Railway (Express API)  |
                                | https://leadcrm-api.onrender.com  |
                                +-----------------------------------+
                                                  |
                                    Prisma ORM (Connection Pooler)
                                                  |
                                                  v
                                +-----------------------------------+
                                |   Supabase (PostgreSQL 16 DB)     |
                                |      db.xyz.supabase.co:6543      |
                                +-----------------------------------+
```

---

## 📋 STEP 1: Supabase Database Setup

### 1.1 Create a Supabase Project
1. Go to **[https://supabase.com](https://supabase.com)** and sign in with GitHub.
2. Click **New Project**.
3. Fill in the details:
   - **Name**: `leadcrm-production`
   - **Database Password**: Set a strong password (e.g., `SuperSecurePass2026!`) and **save it safely**.
   - **Region**: Choose the region closest to your target users (e.g., *Singapore* or *US East*).
4. Click **Create new project** and wait ~2 minutes for provision completion.

### 1.2 Copy Connection Strings
1. In your Supabase Dashboard, go to **Project Settings (Gear Icon)** → **Database**.
2. Scroll to **Connection Strings**:
   - Under **Transaction Pooler (Port 6543)**, copy the URI:
     ```env
     DATABASE_URL="postgres://postgres.YOUR_PROJECT_REF:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
     ```
   - Under **Direct Connection (Port 5432)**, copy the URI:
     ```env
     DIRECT_URL="postgres://postgres.YOUR_PROJECT_REF:[YOUR-PASSWORD]@db.YOUR_PROJECT_REF.supabase.co:5432/postgres"
     ```
3. Replace `[YOUR-PASSWORD]` in both strings with your actual database password.

---

## 🛠️ STEP 2: Database Migration & Seeding from Local Machine

Run the Prisma migrations against your live Supabase database before starting the backend.

1. Open a terminal in your project root:
   ```bash
   cd backend
   ```
2. Set the `DATABASE_URL` environment variable temporarily and run migrations:

   **On Windows (PowerShell):**
   ```powershell
   $env:DATABASE_URL="postgres://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
   $env:DIRECT_URL="postgres://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres"

   # Deploy Prisma Schema (creates all 30 tables in Supabase)
   npx prisma migrate deploy

   # Seed the database with System Admin + default pipeline stages + default roles
   npm run db:seed
   ```

   **On macOS / Linux:**
   ```bash
   export DATABASE_URL="postgres://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
   export DIRECT_URL="postgres://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres"

   npx prisma migrate deploy
   npm run db:seed
   ```

3. Open **Supabase Dashboard** → **Table Editor** to confirm all 30 tables (`Tenant`, `User`, `Contact`, `Deal`, `SystemAdmin`, etc.) are populated!

---

## ⚙️ STEP 3: Backend API Deployment (Render or Railway)

Because LeadCRM has an Express.js API server (`backend/`), we deploy it to a Node.js host. We recommend **Render.com** (free/affordable) or **Railway.app**.

### 3.1 Deploying to Render.com

1. Go to **[https://render.com](https://render.com)** and log in.
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository `OWN-CRM-1`.
4. Configure Web Service settings:
   - **Name**: `leadcrm-backend-api`
   - **Region**: Same region as Supabase (e.g. *Singapore* or *US East*)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npm run start`
5. Scroll to **Environment Variables** and add:

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | `10000` |
   | `DATABASE_URL` | *(Your Supabase Transaction Pooler URL from Step 1)* |
   | `DIRECT_URL` | *(Your Supabase Direct Connection URL from Step 1)* |
   | `JWT_SECRET` | `a_min_32_character_super_secret_jwt_string_key_2026` |
   | `ALLOWED_ORIGINS` | `https://your-leadcrm.vercel.app` *(or `*` temporarily)* |
   | `SYSTEM_ADMIN_EMAIL` | `admin@leadcrm.io` |
   | `SYSTEM_ADMIN_PASSWORD` | `admin123` |

6. Click **Create Web Service**. Render will build and deploy your Express API.
7. Once deployed, copy your Render API URL (e.g., `https://leadcrm-backend-api.onrender.com`).

---

## 🌐 STEP 4: Frontend Deployment on Vercel

### 4.1 Import Repository to Vercel
1. Go to **[https://vercel.com](https://vercel.com)** and sign in.
2. Click **Add New...** → **Project**.
3. Select your GitHub repository: `reymarkjpanes/OWN-CRM-1`.

### 4.2 Configure Vercel Project Settings
1. **Framework Preset**: Select **Next.js**.
2. **Root Directory**: Click *Edit* and select `frontend`.
3. **Build & Development Settings**: Leave default (`npm run build`).

### 4.3 Set Environment Variables on Vercel
Expand **Environment Variables** and add:

| Environment Variable | Value | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://leadcrm-backend-api.onrender.com` | Points to your Render backend URL |
| `NEXT_PUBLIC_USE_MOCK_DATA` | `false` | Disables localStorage mock mode & connects to real API |

> [!TIP]
> If you want an offline demo deployment on Vercel without backend server dependency, set `NEXT_PUBLIC_USE_MOCK_DATA=true`.

### 4.4 Click Deploy!
Vercel will compile Next.js 15, bundle assets, and deploy to a URL like `https://own-crm-1.vercel.app`.

---

## 🔒 STEP 5: Final CORS Alignment & Production Check

1. Go back to **Render Dashboard** → **Environment Variables**.
2. Set `ALLOWED_ORIGINS` to your exact Vercel deployment domain:
   ```env
   ALLOWED_ORIGINS="https://own-crm-1.vercel.app"
   ```
3. Save changes — Render will automatically restart.

---

## 🧪 STEP 6: Testing & Launching

1. Open your Vercel URL: `https://own-crm-1.vercel.app`.
2. Login with your initial System Admin credentials:
   - **Email**: `admin@leadcrm.io` (or your `SYSTEM_ADMIN_EMAIL`)
   - **Password**: `admin123` (or your `SYSTEM_ADMIN_PASSWORD`)
3. Access System Admin Console at `https://own-crm-1.vercel.app/admin`.
4. Test creating a new Client Tenant, logging into CRM Portal, and managing Deals/Pipeline.

---

## 📱 Mobile PWA Installation in Production

Once deployed to Vercel:
1. Open `https://own-crm-1.vercel.app` on Safari (iOS) or Chrome (Android).
2. Tap **Share / Menu** → **Add to Home Screen**.
3. LeadCRM will install as a native-feeling application with offline capabilities and push-style responsiveness.

---

## ❓ Frequently Asked Questions

### Q: Why do we need Render/Railway in addition to Vercel?
Next.js on Vercel hosts the **Frontend UI**. Because LeadCRM includes an **Express.js REST API backend** (`backend/`) with Prisma ORM and 85+ API endpoints, hosting the backend on Render/Railway provides a persistent Node runtime to handle CORS, database connections, and JWT sessions seamlessly.

### Q: Can I run frontend and backend together on Vercel?
Yes, using `NEXT_PUBLIC_USE_MOCK_DATA=true`, the frontend runs standalone on Vercel with zero external server dependencies! For live PostgreSQL database integration, the recommended setup is Vercel (Frontend) + Render (Backend) + Supabase (Database).
