# Security Fixes & Cleanup — Work List

> Generated from security review and code audit on 2026-02-15
> Covers all uncommitted changes across 6 changesets

---

## Security Fixes (HIGH)

- [ ] **H-3. XSS in packing slip via customer notes** — `customer_notes` is user-controlled input interpolated directly into HTML template string with only `\n` → `<br>` replacement. No HTML entity escaping. A customer can inject `<img onerror="...">` that fires when admin opens packing slip.
  - File: `src/admin/pages/FulfillmentPage.tsx` (~line 350)
  - Fix: HTML-escape `customer_notes` before inserting into template
  - ```typescript
    const escapeHtml = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    // Then: escapeHtml(order.customer_notes).replace(/\n/g, '<br>')
    ```

- [x] **H-1. Blog content rendered without DOMPurify** — `dangerouslySetInnerHTML={{ __html: post.content }}` with no sanitization. Admin-authored but lacks defense-in-depth. DOMPurify is already a project dependency (used in ProductDetailModal).
  - File: `components/BlogPostPage.tsx` (line 182)
  - File: `components/BlogPage.tsx` (line 114, CMS headline)
  - Fix: `import DOMPurify from 'dompurify'` and wrap content

- [x] **H-2. FAQ answers rendered without DOMPurify** — Same pattern as H-1. Rich text FAQ answers via `dangerouslySetInnerHTML={{ __html: answer }}`.
  - File: `components/FAQPage.tsx` (line 57)
  - Fix: Same DOMPurify approach

---

## Security Fixes (MEDIUM)

- [ ] **M-1. Customer reviews rendered without sanitization** — `dangerouslySetInnerHTML={{ __html: review.text }}` without DOMPurify.
  - File: `components/CustomerReviews.tsx` (~line 204)

- [x] **M-2. Blog image upload lacks file type validation** — Only relies on client-side `accept="image/*"` attribute. No MIME type or extension check before upload.
  - File: `src/admin/pages/BlogEditPage.tsx` (lines 115-146)
  - Fix: Validate `file.type` against allowlist before uploading

- [ ] **M-3. External product URLs not validated** — `<a href={externalUrl}>` with no protocol check. A `javascript:` URL in the DB could execute code.
  - Files: `components/ProductCard.tsx`, `components/ProductDetailModal.tsx`
  - Fix: Validate URL starts with `https://` or `http://`

- [x] **M-4. Blog queries use `select('*')` — overly broad** — Public blog queries return all columns. Should select only needed fields.
  - Files: `components/BlogPage.tsx`, `components/BlogPostPage.tsx`

- [ ] **M-5. No DB-level length constraint on customer_notes** — Frontend limits to 500 chars but easily bypassed. Column is unbounded `TEXT`.
  - File: `supabase/migrations/20260215150000_add_customer_notes_to_orders.sql`
  - Fix: Add `CHECK (length(customer_notes) <= 2000)` constraint

---

## Security Fixes (LOW)

- [ ] **L-1. `decodeURIComponent` on blog slug could throw** — Malformed percent-encoding in URL causes unhandled exception.
  - File: `App.tsx` (line 184, 307)
  - Fix: Wrap in try-catch with fallback

---

## Code Cleanup

- [x] **C-1. Duplicate blog migration timestamp conflict** — Two files at `20260215160000`. Deleted `_create_blog_posts.sql`, kept `_add_blog_posts_table.sql` (has `updated_at` trigger).

- [x] **C-2. Deleted `nul` Windows artifact** — Removed from repo root.

- [x] **C-3. Added `supabase/.temp/` to `.gitignore`** — Prevents temp files from being committed.

- [x] **C-4. Removed unused `onNavigate` prop from BlogPage** — Prop was declared but never used.

- [x] **C-5. Removed `tags` column references** — BlogPage/BlogPostPage interfaces and rendering aligned with actual migration schema.

---

## Pending Verification (Pre-Commit)

- [ ] **V-1. About page section IDs match Header links** — Header hardcodes `our-story`, `our-approach`, `technology`, `our-team`. Verify these IDs exist as element attributes in `components/AboutPage.tsx`.

- [ ] **V-2. FAQPage restructure (165 lines changed)** — Substantial refactor needs visual QA. Verify search/filter, category navigation, and "no results" state all work.

- [ ] **V-3. ProductCard refactor (93 lines changed)** — Significant rewrite. Verify card rendering, external product links, out-of-stock states, and add-to-cart behavior.

- [ ] **V-4. ProductDetailModal bundle implementation** — Bundle "What's Included" section added. Verify bundle items display correctly and purchase flow works.

- [ ] **V-5. ShipEngine sandbox/production mode toggle** — Verify admin UI correctly saves/switches modes and edge function resolves correct API key.

- [ ] **V-6. Customer notes end-to-end** — Verify notes appear in checkout, persist to DB via RPC, and display in admin order detail and packing slip.

- [ ] **V-7. Blog feature end-to-end** — Verify `/blog` listing, `/blog/:slug` detail, admin CRUD, back/forward navigation, empty state.

---

## Summary

| Priority | Count | Status |
|----------|-------|--------|
| HIGH security | 3 | 1 open, 2 done |
| MEDIUM security | 5 | 3 open, 2 done |
| LOW security | 1 | Open |
| Cleanup | 5 | All done |
| Verification | 7 | Open |
