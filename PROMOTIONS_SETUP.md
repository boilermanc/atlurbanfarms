# Promotions System Setup Instructions

## ✅ What's Been Fixed

Your promotions system had column name mismatches between the database and TypeScript code. I've corrected everything to match your actual Supabase database schema:

### Schema Corrections Made:
- `scope` values: `'site'` instead of `'site_wide'`
- `activation_type` values: `'coupon'` instead of `'code'`
- Column names:
  - `banner_background_color` (not `banner_bg_color`)
  - `show_banner` (not `show_on_homepage`)
  - `max_uses` (not `usage_limit_total`)
  - `max_uses_per_customer` (not `usage_limit_per_customer`)
  - `times_used` (not `usage_count`)
  - `total_discount_given` (new field)

## 🚀 Setup Steps

### Step 1: Apply Database Migration

1. Open your Supabase dashboard: https://app.supabase.com/project/povudgtvzggnxwgtjexa
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open the file `APPLY_THIS_SQL.sql` in this directory
5. Copy ALL contents and paste into the SQL Editor
6. Click **Run** or press `Ctrl+Enter`
7. Wait for "Success. No rows returned" message

### Step 2: Verify Installation

Run this test query in the SQL Editor:

```sql
SELECT * FROM get_active_banners();
```

If it returns with no errors (empty result is fine), you're good to go!

### Step 3: Refresh Your Browser

1. Go to your dev server: http://localhost:5173
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Check the console - the 404 errors should be gone!

## 📋 What Got Created

### Database Tables:
- ✅ `promotions` (already existed)
- ✅ `promotion_products` (junction table)
- ✅ `promotion_categories` (junction table)
- ✅ `promotion_customers` (junction table)
- ✅ `promotion_usage` (tracking table)
- ✅ Orders table updated with promotion columns

### Database Functions:
- ✅ `get_product_promotions(uuid)` - Get best promo for a product
- ✅ `get_products_promotions(uuid[])` - Batch get promos
- ✅ `calculate_cart_discount(...)` - Calculate cart discounts
- ✅ `get_active_banners()` - Get homepage banners
- ✅ `record_promotion_usage(...)` - Track promo usage
- ✅ `validate_coupon_code(text)` - Quick coupon validation

### TypeScript Updates:
- ✅ Types match your actual database schema
- ✅ Hooks use correct column names
- ✅ Components ready to use promotions

## 🧪 Test the System

### Create a Test Promotion (In Supabase Dashboard)

Run this in SQL Editor:

```sql
INSERT INTO promotions (
  name,
  description,
  discount_type,
  discount_value,
  scope,
  activation_type,
  show_banner,
  banner_text,
  is_active
) VALUES (
  'Test Sale',
  '10% off everything',
  'percentage',
  10,
  'site',
  'automatic',
  true,
  '🎉 Test Sale - 10% Off Everything!',
  true
);
```

Then refresh your app - you should see the banner!

## 📁 Files Modified

### Database Migrations Created:
- `supabase/migrations/20260123100002_add_remaining_promotion_tables.sql`
- `supabase/migrations/20260123100003_add_promotion_functions_fixed.sql`
- `APPLY_THIS_SQL.sql` (combined file for easy application)

### TypeScript Files Updated:
- `src/admin/types/promotions.ts` - Fixed types to match database
- `src/hooks/useSupabase.js` - Added promotion tracking to orders
- `src/components/OrderConfirmationPage.tsx` - Added savings display
- `App.tsx` - Added promotional banner to all pages
- `components/PromotionalBanner.tsx` - Already created
- `components/CartDrawer.tsx` - Already has auto-apply logic

## ❓ Troubleshooting

### Still seeing 404 errors?
- Make sure you ran the SQL file completely
- Hard refresh your browser (Ctrl+Shift+R)
- Check Supabase logs for any errors

### Errors about column names?
- Run this in SQL Editor to check your promotions table:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'promotions';
```

### Functions not found?
- Re-run the SQL file
- Check that functions were created:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%promotion%';
```

## 🎉 Next Steps

Once the database is set up:
1. Create your first promotion in the admin panel
2. Test automatic discounts in the cart
3. Test coupon codes at checkout
4. Verify order confirmation shows savings

Need help? Check the console for any remaining errors!
