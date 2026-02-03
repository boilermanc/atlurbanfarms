# ATL Urban Farms - AI Coding Guidelines

> Primary reference document for AI agents working on this codebase.

---

## Project Context

ATL Urban Farms is a **live plant seedlings e-commerce platform** undergoing migration from WooCommerce to a modern React/Supabase stack.

**Business Model:** Weekly batch fulfillment
- Orders collected throughout the week
- **Sunday 11:59 PM ET cutoff** for current batch
- Plants harvested and shipped Monday-Tuesday
- No weekend delivery (live plants)

**Current State:**
- Platform URL: `deux.atlurbanfarms.com` (pre-launch)
- 321 products migrated across 9 categories
- 18+ admin panel sections
- 26 database tables
- Supabase project: `povudgtvzggnxwgtjexa.supabase.co`

---

## Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | React + TypeScript | Vite build, TailwindCSS |
| Backend | Supabase | PostgreSQL, Edge Functions, Auth, Storage |
| Payments | Stripe | Checkout Sessions, webhooks |
| Email | Resend | Transactional emails |
| Shipping | ShipEngine | Rate shopping, label generation |
| Hosting | IONOS VPS | Production deployment |
| Automation | n8n | Workflow automation |
| Development | Cursor AI | AI-assisted development |

---

## Key People

| Person | Role | Domain |
|--------|------|--------|
| **Clint** | Technical Lead | Architecture, code, deployment |
| **Sheree** | Farm Ops & QA | Testing, farm.sproutify.app management |

---

## Operating Principles

### 1. Correctness Over Cleverness
Write code that is obviously correct, not code that is cleverly correct. Prefer boring, proven patterns over novel approaches.

### 2. Smallest Change That Works
Minimize blast radius. Don't refactor adjacent code unless explicitly requested. A bug fix is just a bug fix.

### 3. Leverage Existing Patterns
Before creating something new, search for existing implementations in the codebase. Mirror established conventions.

### 4. Prove It Works
Every change must be verifiable. Show the test, show the query result, show the UI behavior.

### 5. Be Explicit About Uncertainty
If you're not sure, say so. "I believe this will work because X" is better than silent assumptions.

---

## Workflow Orchestration

### Plan Mode Default
Start complex tasks in plan mode. Outline the approach before writing code.

### Subagent Strategy
Use specialized agents for exploration, code search, and parallel work streams.

### Incremental Delivery
Ship working increments. Don't batch large changes.

### Self-Improvement Loop
After each significant task, update `tasks/lessons.md` with learnings.

### Verification Before Done
Never mark a task complete without demonstrating it works:
- Show the query result
- Show the UI screenshot
- Show the test passing

### Demand Elegance
Code should be simple enough that bugs have nowhere to hide.

### Autonomous Bug Fixing
When tests fail or errors occur during implementation, fix them immediately. Don't leave broken code.

---

## Task Management

**File-based auditable system:**
- `tasks/todo.md` - Current work tracking
- `tasks/lessons.md` - Patterns from mistakes

### Parallel Cursor Workflow

For batch issue resolution:
1. **Batch HIGH priority** → Run 3 parallel agents
2. **Batch MEDIUM priority** → Run 3 parallel agents
3. **Batch LOW priority** → Run 3 parallel agents
4. **Create `Testing_Checklist.md`** for Sheree after each batch

---

## Communication Guidelines

### Concise High-Signal
- Lead with the answer
- Bullet points over paragraphs
- Code over explanation when possible

### Ask Only When Blocked
Don't ask for clarification if you can make a reasonable assumption. State the assumption instead.

### State Assumptions
"Assuming you want X because Y" — then proceed. Correct if wrong.

### Show Verification Story
Don't just say "done." Show:
- What changed
- How to verify
- What could break

---

## Context Management

### Read Before Write
Always read the current state of files before modifying. Never assume file contents.

### Keep Working Memory
Track decisions and constraints in `tasks/todo.md` Working Notes section.

### Minimize Cognitive Load
One concern per PR. One purpose per function. One reason to change per module.

### Control Scope Creep
If you notice adjacent improvements, log them as future tasks. Don't fix them now unless explicitly asked.

---

## Error Handling

### Stop-the-Line Rule
When something fails unexpectedly, stop and understand why before proceeding.

### Triage Checklist
1. **Reproduce** - Can you make it happen consistently?
2. **Localize** - What component/function is failing?
3. **Reduce** - What's the minimal reproduction?
4. **Fix** - Apply the smallest correct fix
5. **Guard** - Add test/validation to prevent recurrence
6. **Verify** - Prove the fix works

### Safe Fallbacks
Edge functions and critical paths must have graceful degradation.

### Rollback Strategy
Know how to undo any deployment. Keep previous working state recoverable.

---

## Project-Specific Conventions

### Database

| Convention | Rule |
|------------|------|
| Table names | `snake_case`, plural (`products`, `order_items`) |
| Primary keys | Always `uuid`, column named `id` |
| Row Level Security | **Always enabled** on all tables |
| Foreign keys | Use `_id` suffix (`product_id`, `order_id`) |
| Timestamps | `created_at`, `updated_at` with defaults |

### Edge Functions

**Standard Pattern:**
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Function logic here

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

### Deployment Commands

```bash
# Deploy single edge function
supabase functions deploy <function-name> --project-ref povudgtvzggnxwgtjexa

# Deploy all edge functions
supabase functions deploy --project-ref povudgtvzggnxwgtjexa

# Set secrets
supabase secrets set KEY=value --project-ref povudgtvzggnxwgtjexa
```

### Admin Panel Structure

```
src/
├── admin/
│   ├── components/    # Admin-specific components
│   ├── hooks/         # Admin data hooks
│   ├── pages/         # Admin page components
│   └── types/         # Admin type definitions
```

---

## Key Integrations

| Service | Endpoint/URL |
|---------|--------------|
| Supabase Project | `povudgtvzggnxwgtjexa.supabase.co` |
| Edge Functions | `https://povudgtvzggnxwgtjexa.supabase.co/functions/v1/{function-name}` |
| Stripe Webhook | `povudgtvzggnxwgtjexa.supabase.co/functions/v1/stripe-webhook` |
| ShipEngine API | `https://api.shipengine.com/v1` |
| Farm Management | `farm.sproutify.app` (future integration) |

---

## Live Plant E-Commerce Rules

### Fulfillment Cycle
- **Batch window:** Sunday 12:00 AM to Sunday 11:59 PM ET
- **Cutoff:** Sunday 11:59 PM ET
- **Harvest & pack:** Monday
- **Ship:** Monday-Tuesday
- **No weekend delivery** - live plants require recipient present

### Inventory
- `quantity_available` reflects current plantable inventory
- Stock decrements on order placement, not payment
- Back-in-stock notifications for zero inventory items

### Shipping
- Address validation required before checkout
- Rate shopping via ShipEngine
- Carrier selection optimizes for transit time (plant health)

---

## Common Gotchas

### Column Name Mismatches
**Wrong:** `stock_quantity`
**Right:** `quantity_available`

Always verify actual schema before writing queries.

### RLS for Guest Checkout
Guest checkout policies cannot rely on `auth.uid()`. Must use alternative verification (email match, order token).

### Edge Function Secrets
Secrets must be explicitly set in Supabase. Local `.env` doesn't deploy automatically.
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx --project-ref povudgtvzggnxwgtjexa
```

### ShipEngine rate_id Expiration
Rate IDs expire quickly. Fetch rates immediately before label purchase, not at cart time.

### SSH Connectivity Issues
IONOS VPS may require key-based auth. Check `~/.ssh/config` for host configuration.

---

## Engineering Best Practices

### Type Safety
- Strict TypeScript (`strict: true`)
- No `any` types without explicit justification
- Generate types from Supabase schema

### Dependency Discipline
- Minimize external dependencies
- Audit packages before adding
- Keep dependencies updated

### Security
- Never commit secrets
- Validate all user input
- Use parameterized queries
- Enable RLS on all tables

### Performance
- Paginate large lists
- Index frequently queried columns
- Lazy load non-critical components
- Optimize images before upload

---

## Definition of Done

A task is complete when:

- [ ] Code compiles with no TypeScript errors
- [ ] Functionality works as specified
- [ ] Edge cases handled
- [ ] No console errors in browser
- [ ] Mobile responsive (if UI change)
- [ ] RLS policies allow required access
- [ ] Verification steps documented
- [ ] Lessons learned updated (if applicable)

---

## Templates

### Plan Template

```markdown
## Plan: [Feature/Fix Name]

### Goal
[One sentence describing the outcome]

### Current State
[What exists now]

### Proposed Changes
1. [Change 1]
2. [Change 2]
3. [Change 3]

### Files Affected
- `path/to/file1.ts`
- `path/to/file2.tsx`

### Risks
- [Potential issue and mitigation]

### Verification
- [ ] [How to verify change 1]
- [ ] [How to verify change 2]
```

### Bugfix Template

```markdown
## Bug: [Brief Description]

### Symptom
[What the user sees]

### Root Cause
[Why it happens]

### Fix
[What changed]

### Verification
[How to confirm it's fixed]

### Prevention
[Guard against recurrence]
```

### Testing Checklist Template for Sheree

See `tasks/testing-checklist-template.md` for the full template.

---

## Pre-Launch Checklist

### Stripe Configuration
- [ ] Webhook endpoint configured: `povudgtvzggnxwgtjexa.supabase.co/functions/v1/stripe-webhook`
- [ ] Webhook events subscribed: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`
- [ ] Live mode keys set in Supabase secrets
- [ ] Test transaction successful

### Product Data Enrichment
- [ ] Top 50 products have complete agricultural data
- [ ] Growing instructions populated
- [ ] Planting zones accurate
- [ ] Product images optimized

### Operations
- [ ] Order notification emails tested
- [ ] Shipping label generation verified
- [ ] Inventory sync confirmed
- [ ] Guest checkout flow tested
- [ ] Authenticated checkout flow tested

---

## Quick Reference

```bash
# Local development
npm run dev

# Type check
npm run typecheck

# Deploy edge function
supabase functions deploy <name> --project-ref povudgtvzggnxwgtjexa

# View edge function logs
supabase functions logs <name> --project-ref povudgtvzggnxwgtjexa

# Database migrations
supabase db push --project-ref povudgtvzggnxwgtjexa
```

---

*Last updated: 2026-02-03*
