# HowToBuddy - Subscription System

This document outlines the setup and configuration of the subscription system for HowToBuddy.

## Features

- Three subscription tiers: Free, Pro, and Enterprise
- Monthly and yearly billing options
- Usage tracking for documents and videos
- Automatic monthly usage reset
- Stripe integration for payments
- Subscription status management
- Usage limits enforcement

## Setup Instructions

### 1. Database Setup

Run the following SQL migration to create the necessary tables:

```sql
-- Run the SQL from supabase/migrations/20240320000000_create_subscriptions.sql
```

### 2. Environment Variables

Add the following environment variables to your `.env` file:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Stripe
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key

# Stripe Price IDs
STRIPE_PRO_MONTHLY_PRICE_ID=price_xxx
STRIPE_PRO_YEARLY_PRICE_ID=price_xxx
STRIPE_ENTERPRISE_MONTHLY_PRICE_ID=price_xxx
STRIPE_ENTERPRISE_YEARLY_PRICE_ID=price_xxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Stripe Setup

1. Create a Stripe account at https://stripe.com
2. Create products and prices for each subscription tier:
   - Pro (Monthly/Yearly)
   - Enterprise (Monthly/Yearly)
3. Configure webhook endpoint:
   - URL: `https://your-domain.com/api/stripe/webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`

### 4. Supabase Edge Functions

Deploy the usage reset function:

```bash
supabase functions deploy reset-usage
```

### 5. Usage Limits

The system enforces the following usage limits:

| Tier       | Documents | Videos | Duration (minutes) |
|------------|-----------|--------|-------------------|
| Free       | 5         | 5      | 60                |
| Pro        | 50        | 50     | 600               |
| Enterprise | 500       | 500    | 6000              |

## API Endpoints

### Subscription Management

- `POST /api/stripe/create-checkout-session`
  - Creates a Stripe checkout session for subscription
  - Body: `{ tier: string, interval: "month" | "year" }`

- `POST /api/stripe/webhook`
  - Handles Stripe webhook events
  - Updates subscription status in database

### Usage Tracking

- Usage stats are automatically tracked when:
  - Creating documents
  - Processing videos
- Monthly usage is automatically reset on the 1st of each month

## Middleware

The subscription middleware (`middleware.ts`) protects routes based on:
- User authentication
- Subscription status
- Usage limits

Protected routes:
- `/dashboard/*`
- `/api/documents/*`
- `/api/videos/*`

## Components

### PricingCard

Displays subscription tier information and pricing.

### SubscriptionPage

Main subscription management page with:
- Pricing plans
- Current usage stats
- Subscription management

## Error Handling

The system handles various error cases:
- Invalid subscription parameters
- Payment failures
- Usage limit exceeded
- Database errors
- Webhook verification failures

## Security

- Row Level Security (RLS) policies protect subscription and usage data
- Stripe webhook signature verification
- Environment variable validation
- Error logging and monitoring

## Monitoring

Monitor the following:
- Subscription status changes
- Usage limit breaches
- Payment failures
- Webhook events
- Database errors

## Caching

The application uses two layers of caching:

1. **Client-side Caching (Required)**
   - Powered by React Query
   - Caches API responses in the browser
   - Automatic background updates
   - Optimistic updates
   - No additional setup required

2. **Server-side Caching (Optional)**
   - Powered by Upstash Redis
   - Caches database queries
   - Reduces database load
   - Requires Redis setup
   - Can be added later when needed

## Deployment

1. Build the application:
   ```bash
   npm run build
   ```
2. Start the production server:
   ```bash
   npm start
   ```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT
