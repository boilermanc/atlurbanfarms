# Lessons Learned

Record patterns from mistakes to prevent recurrence.

---

## Template
### [Date] - [Brief Title]
**Failure mode:** What went wrong
**Detection signal:** How it was caught
**Prevention rule:** Rule to prevent recurrence

---

## Entries

### 2024-XX-XX - Column Name Mismatches
**Failure mode:** Queries failed because assumed column names didn't match actual schema
**Detection signal:** Frontend errors, failed API calls
**Prevention rule:** Always verify actual database schema with Supabase before writing queries. Use `quantity_available` not `stock_quantity`.

### 2024-XX-XX - RLS Guest Checkout
**Failure mode:** Guest checkout blocked by RLS policies expecting auth.uid()
**Detection signal:** 403 errors on guest orders
**Prevention rule:** Test both authenticated AND guest checkout flows. Guest checkout requires policies that don't rely on auth.uid().

### 2024-XX-XX - Edge Function Secrets Not Deploying
**Failure mode:** Edge function worked locally but failed in production
**Detection signal:** Function returned undefined for environment variables
**Prevention rule:** Always explicitly set secrets via `supabase secrets set` CLI command after deploying functions.

### 2024-XX-XX - ShipEngine Rate Expiration
**Failure mode:** Label purchase failed with "rate not found" error
**Detection signal:** Checkout completion failures
**Prevention rule:** Fetch shipping rates immediately before label purchase. Don't cache rate_ids from cart time.

### 2024-XX-XX - PostgREST Relationship Ambiguity
**Failure mode:** Queries with joins failed due to ambiguous foreign key relationships
**Detection signal:** PostgREST errors about ambiguous relationships
**Prevention rule:** Use explicit relationship hints in Supabase queries when tables have multiple foreign keys to the same table.

---

## Categories

### Database
- Schema verification before queries
- RLS policy testing for all user types
- Relationship disambiguation

### Edge Functions
- Secret management
- CORS configuration
- Error response format consistency

### Integrations
- API key expiration handling
- Rate limiting awareness
- Webhook idempotency

### Frontend
- Type safety with database types
- Loading state handling
- Error boundary coverage
