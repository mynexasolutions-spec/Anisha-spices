# 🌿 Anisha Spices

> **Pure Spice. Real Taste. Trusted Every Time.**  
> A full-stack, production-ready D2C e-commerce platform built with Next.js (App Router), Supabase (PostgreSQL + Auth + RLS), Brevo (Transactional Email & Auth OTPs), and Razorpay.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** v18+ (tested on Node v20/v22)
- **npm** or **pnpm** / **yarn**

### 2. Installation & Run
```bash
# Clone the repository
git clone https://github.com/mynexasolutions-spec/Anisha-spices.git
cd Anisha-spices

# Install dependencies
npm install

# Start development server
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🔑 Environment Variables (`.env.local`)

Create a `.env.local` file in the root directory:

```env
# ─── Supabase Database & Auth ─────────────────────────────
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# ─── Admin Seed Credentials ───────────────────────────────
ADMIN_EMAIL="admin@anishamasala.com"
ADMIN_PASSWORD="your-secure-admin-password"

# ─── Brevo (Transactional Emails & Auth OTPs) ──────────────
BREVO_API_KEY="xkeysib-..."
BREVO_SENDER_EMAIL="noreply@yourdomain.com"
BREVO_SENDER_NAME="Anisha Masale"

# ─── Razorpay Payment Gateway ─────────────────────────────
NEXT_PUBLIC_RAZORPAY_KEY_ID="rzp_live_..."
RAZORPAY_KEY_ID="rzp_live_..."
RAZORPAY_KEY_SECRET="your-razorpay-key-secret"
RAZORPAY_WEBHOOK_SECRET="your-razorpay-webhook-secret"

# ─── Cloudinary (Product Media Uploads) ───────────────────
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

---

## 🔐 Credentials & Access URLs

| Portal | URL | Description |
|---|---|---|
| **Storefront** | [`/`](http://localhost:3000/) | Customer marketplace & catalog |
| **Store Admin Dashboard** | [`/admin`](http://localhost:3000/admin) | Management suite (Orders, Inventory, Customers) |
| **Admin Login** | [`/admin/login`](http://localhost:3000/admin/login) | Secured admin authentication |
| **Customer Auth** | [`/login`](http://localhost:3000/login) | Customer Sign In, Sign Up (OTP), and Password Reset |

---

## ✨ Key Features & Architecture

### 🛡️ Authentication Lifecycle (Brevo + Supabase)
- **Sign Up via 6-Digit Email OTP**: Verified registration via Brevo email OTP (10-minute expiry with attempt counters).
- **Zero-Quota Email/Password Login**: Returning customers log in instantly with email & password without consuming email quota.
- **Forgot Password Workflow**: Secure 64-character tokenized single-use reset links sent via Brevo (15-minute expiry).
- **Cart Session Merging**: Automatic synchronization of guest cart items into customer account upon login.

### 💳 Payment & Webhooks Infrastructure
- **Dual Payment Options**: Cash on Delivery (COD) and Online Payments via Razorpay.
- **Razorpay Webhook API (`/api/webhooks/razorpay`)**:
  - Background event listener for `order.paid` and `payment.captured`.
  - **HMAC-SHA256 Signature Verification** with timing-safe comparison to block unauthorized requests.
  - **Idempotency Guard**: Guarantees zero duplicate database updates and prevents duplicate invoice emails.
  - Automatic order status updates to `paid` and `processing`.
- **Royal Invoice Emails**: Beautiful branded email receipts delivered via Brevo upon order confirmation (with itemized pricing, discounts, shipping fees, and address breakdown).

### 🛍️ Storefront (Customer Experience)
- **Dynamic Spice Catalog**: Handcrafted Indian spices with multiple variant pack sizes (50g, 100g, 250g, 500g, 1kg).
- **Hybrid Cart Engine**: Guest cart (HTTP cookies) + Authenticated cart (`cart_items` in Supabase).
- **Live Free Shipping Threshold Bar**: Real-time progress tracker towards free shipping.
- **Pincode Lookup**: Automatic city/state detection via Indian Postal PIN code API.
- **Customer Account Dashboard (`/account/orders`)**: Real-time status tracker (*Placed ➔ Processing ➔ Shipped ➔ Delivered*).
- **Address Book (`/account/addresses`)**: Saved address manager with default address selection.

### 👑 Admin Management Suite (`/admin`)
- **Dashboard Overview**: Revenue metrics, order counter, customer volume, and sales graphs.
- **Product & Inventory Manager**: Full control over products, pack weights, SKU stock, and images.
- **Order Processing Suite**: View customer contact, order history, shipping snapshots, and fulfill orders.
- **Shipping Settings (`/admin/settings/shipping`)**: Dynamic control over free delivery threshold and standard delivery fees.
- **Storefront Content Management**: Live controls for hero banners, announcement bars, and product FAQs.

---

## 🗄️ Database Architecture (Supabase PostgreSQL)

### Database Migrations
Migrations are managed in `supabase/migrations/`:
- `00001_initial_schema.sql`: Primary schema for products, variants, categories, orders, order items, and profiles.
- `20260625000000_add_shipping_address_snapshot.sql`: Permanent JSONB shipping address snapshot on orders.
- `20260701000000_brevo_auth_tables.sql`: Dedicated auth tables `auth_signup_otps` and `password_reset_tokens` with RLS protection.

### Core Tables

| Table | Purpose | Security & RLS |
|---|---|---|
| `profiles` | User directory with RBAC (`customer` / `admin`) | RLS: Users read/write own profile, Admins full access |
| `categories` | Product categories & slugs | Public read, Admin write |
| `products` | Base product data & descriptions | Public read, Admin write |
| `product_variants` | Pack weights, prices, and stock inventory | Public read, Admin write |
| `orders` | Customer orders, payment & delivery status, snapshots | Users view own orders, Admin full access |
| `order_items` | Itemized order lines snapshot at purchase | Users view own items, Admin full access |
| `addresses` | Saved customer addresses | Users view/edit own addresses |
| `cart_items` | Customer cart items | Users view/edit own cart |
| `auth_signup_otps` | Temporary encrypted signup requests & OTPs | Service role only |
| `password_reset_tokens`| Single-use crypto password reset tokens | Service role only |

---

## 🛠️ Tech Stack

- **Framework**: Next.js (App Router, Server Actions, Turbopack)
- **Language**: TypeScript
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Email Service**: Brevo API v3 (REST SMTP client with IPv4 prioritization)
- **Payments**: Razorpay SDK + Webhooks + Cash on Delivery (COD)
- **Styling**: Tailwind CSS & Lucide Icons
- **Media**: Cloudinary Widget + Local Optimized Assets

---

## 📜 License
Private & Proprietary — Developed for **Anisha Spices**.
