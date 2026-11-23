# Armanitollian Club — Member Portal & Management System

Enterprise-level bilingual (**English & বাংলা**) web application for **Armanitollian Club** (Armanitola Govt. High School Alumni Association) built with **React, Tailwind CSS v4, Express, SQLite (`node:sqlite`), and ShurjoPay v2**.

---

## Key Features

- **Public Member Portal (Default Landing Page)**:
  - **Public Registration Form (`/#register`)**: Dynamic 4-step bilingual form with all 20+ personal/academic/document fields, white-background photo preview, NID PDF & SSC Passing Proof upload, auto-detected Alumni Batch Category, and live installment preview.
  - **Track Application & Member Payments (`/#portal`)**: Track application status by Tracking ID or Phone Number; approved members look up payments using **Club ID + Phone Number** and pay online via **ShurjoPay**.
- **Password-Protected Admin Dashboard (`/#admin`)**:
  - Secured with `scrypt` hashed passwords & HMAC-SHA256 tokens.
  - **Member Approvals**: Inspect applications & documents, add committee remarks, Approve (auto-issue Club Member ID), Request Revision, Reject, or Bulk Approve.
  - **Members & Subscriptions**: Search/filter directory, **Edit Any Member's Data**, switch subscription plans, print Digital Member ID Cards, and export CSV.
  - **Monthly Payments & Installments**: Search-based installment tracker (Jan 2027 First-Month Payment + Feb 2027+ batch-based installments), Payment Ledger, verification, and Printable Official Receipts.
  - **Settings & Governance**: Enable/Disable any Subscription Plan, toggle Installment Eligibility per plan, change Start Month, Dynamic Form Builder, Change Admin Password, JSON Backup, and Admin Audit Log.

---

## Quick Start (Development)

```bash
npm install
npm run server   # Starts Express API + SQLite DB on http://localhost:4000
npm run dev      # Starts Vite frontend on http://localhost:5173
```

## Production Deployment

1. Copy `.env.example` to `.env` and update:
   - `APP_BASE_URL` & `API_BASE_URL` to your production domain (e.g., `https://club.yourdomain.com`)
   - `AUTH_SECRET` to a long random secret string
   - `ADMIN_PASSWORD` (or change it inside **Admin → Settings → Data & Backup**)
   - **ShurjoPay Live Credentials**:
     ```env
     SHURJOPAY_MODE=live
     SHURJOPAY_USERNAME=your_live_username
     SHURJOPAY_PASSWORD=your_live_password
     SHURJOPAY_PREFIX=your_live_prefix
     ```
2. Build and run on a single Node.js process (Node 22.5+ / Node 24):
   ```bash
   npm run build
   npm start
   ```
   Express automatically serves the production frontend (`dist/`), API (`/api/*`), and persists all data in `server/data/armanitollian.db`.
