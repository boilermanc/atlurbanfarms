# Website Issues Tracker (0211) — Work List

> Generated from verification audit on 2026-02-13
> Source: Website Issues Tracker (0211) open issues
> **Review completed: 2026-02-13** — All 21 items verified against code diffs

---

## Quick Fixes

- [x] **1. Shop header description width** — Changed `max-w-2xl` → `max-w-4xl` on description in `components/ShopPage.tsx:530`
- [x] **2. Site Content: close all subsections by default** — Changed `expandedSections` init to empty `new Set()` in `src/admin/pages/SiteContentPage.tsx:398`
- [x] **3. Founder image upload field** — Added `founder_image` field to Our Story section in CONTENT_STRUCTURE + default in `src/hooks/useSiteContent.tsx`
- [x] **4. Hide blank image captions on About page** — Added conditional render; captions only show when non-empty (`components/AboutPage.tsx:165-170`)
- [x] **5. About Team title/role → white** — Changed `brand-text` → `text-white` on grower title (`components/AboutPage.tsx:399`)
- [x] **6. Notify button → "Out of Stock" text** — Changed label to "Out of Stock – Notify Me" in `components/ProductCard.tsx:312`
- [x] **7. Top nav hover font effect** — Added `hover:scale-105` on nav buttons in `components/Header.tsx` (Shop, nav items, About)
- [x] **8. Hide cart icon when empty** — Cart button now hidden with AnimatePresence when `cartCount === 0` (`components/Header.tsx:648-672`)

## Medium Complexity

- [x] **9. Color picker: brand colors + recently used** — Brand colors pulled from `useBrandingSettings()` into RichTextEditor presets; expanded color grid (8x3); full hex + RGB custom input with Apply button (`src/admin/components/RichTextEditor.tsx`)
  - **Note:** "Recently used" color tracking not implemented (no localStorage history). Brand colors ✅, RGB input ✅, expanded palette ✅.
- [x] **10. Double section header font sizes** — Headings increased across: ProductGrid (`text-5xl md:text-7xl`), FeaturedSection, CategorySection, ShopPage section headers (`text-4xl md:text-6xl`), SchoolsPromoSection
- [x] **11. Remove Best Sellers section from Home page** — `ProductGrid` import removed from App.tsx; replaced with `CustomerReviews` + `SproutifySection`. Best Sellers component still exists but is no longer rendered on home page.
- [x] **12. Shop categories: include On Sale items and Bundles** — Added fallback to primary category when `category_assignments` is empty; rewrote subcategory grouping to use `category_assignments` junction table instead of just primary category (`components/ShopPage.tsx:380-415`)

## Larger Features

- [x] **13. Top Nav Redesign** — Desktop nav restructured: emerald-900 background, white rounded pill (`bg-white rounded-full`) containing logo + nav links with divider, separate white rounded pill for search/profile/cart (`lg:bg-white lg:rounded-full lg:shadow-lg`). (`components/Header.tsx`)
- [x] **14. Hero Video upload support** — Added `select` field type to SiteContentPage; Hero Section now has `hero_media_type` (image/video) selector with conditional `image_url` / `hero_video_url` fields. `Hero.tsx` renders `<video>` when type is video. Defaults to image for backwards compatibility.
- [x] **15. Customer Reviews scrolling section** — New `components/CustomerReviews.tsx`: auto-scrolling carousel (4s interval), CMS-driven via `home/reviews` section (6 review slots), star ratings, avatar fallback, pause on hover. Admin management via SiteContentPage reviews section.
- [x] **16. Mission Section ("The ATL Urban Farms Standard")** — Added `home/mission` section to CONTENT_STRUCTURE with heading, description, button text/link, optional image. `ProductGrid.tsx` now renders mission content from CMS instead of hardcoded text.
- [x] **17. Sproutify Home app section** — New `components/SproutifySection.tsx`: CMS-driven via `home/sproutify` section with enable/disable toggle. Renders image + heading + description + CTA. Supports internal navigation and external links.
- [x] **18. Events Calendar admin page** — Added search filter (title/description/location), type filter dropdown, status filter dropdown, clear filters button, result count. Column sorting (title, type, date, status) with asc/desc toggle and sort icons. (`src/admin/pages/ShippingCalendarPage.tsx`)
- [x] **19. Events Calendar detail view** — Added `map_url` and `registration_link` fields to event form (admin). Description changed from `<textarea>` to RichTextEditor. Public CalendarPage renders formatted HTML description, location as map link, and "Register" button. DB migration: `20260213100000_add_event_map_url_registration_link.sql`.
- [x] **20. Duplicate event ability** — Added `handleDuplicateEvent()` function + Copy icon button in event actions row. Creates copy with "(Copy)" suffix, no recurrence, no parent link.
- [x] **21. Bundle stock calculation** — New `enrichBundleStock()` in `src/hooks/useSupabase.js`: queries `product_relationships` table, computes `MIN(FLOOR(child_qty / required_qty))` across all components. Applied in `useProducts()`, `useBestSellers()`, and `FeaturedSection`. Bundle `quantity_available` and `stock_status` derived at runtime.

## Already Done (pre-existing)

- [x] **ShipEngine/ShipStation shipping rates** — Architecture supports both carrier sources via `carrier_configurations` table
- [x] **External products out of stock hidden** — `ProductsPage.tsx:150-152` filters them unless searching
- [x] **About dropdown links to sections** — `Header.tsx:161-181` uses hash anchors with scroll behavior
- [x] **Signup redirects to Welcome page** — `App.tsx:527-530` checks localStorage and redirects first-time users

---

## Review Notes

### TypeScript
- No new TS errors introduced. Only pre-existing framer-motion `Variants` type errors in `CategorySection.tsx` and `OrderConfirmation.tsx` (documented).

### New Files
- `components/CustomerReviews.tsx` — Customer reviews carousel
- `components/SproutifySection.tsx` — Sproutify app promo section
- `components/MissionSection.tsx` — Mission banner (extracted from deleted ProductGrid)
- `supabase/migrations/20260213100000_add_event_map_url_registration_link.sql` — DB migration for event fields

### Files Modified (16)
App.tsx, Header.tsx, Hero.tsx, AboutPage.tsx, ProductCard.tsx, ShopPage.tsx, FeaturedSection.tsx, CategorySection.tsx, CalendarPage.tsx, RichTextEditor.tsx, SiteContentPage.tsx, ShippingCalendarPage.tsx, useSiteContent.tsx, useSupabase.js, settings.local.json

### Files Deleted
- `components/ProductGrid.tsx` — Dead code after Best Sellers removal; Mission Section extracted to `MissionSection.tsx`

### Remaining Minor Gaps
All gaps resolved:
- ~~Color picker "recently used" colors~~ — ✅ Added localStorage-based recent color tracking (max 8 colors)
- ~~Best Sellers component dead code~~ — ✅ Deleted `ProductGrid.tsx`; Mission Section extracted to standalone `MissionSection.tsx` and added to `App.tsx`
- ~~DB migration~~ — ✅ Pushed via `supabase db push` (columns already existed, applied cleanly with `IF NOT EXISTS`); also repaired migration history for 22 previously untracked migrations
