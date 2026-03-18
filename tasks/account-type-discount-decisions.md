# Account-Type Discount Feature — Decisions

**Date:** 2026-03-17
**Decided by:** Sheree

---

## 1. Discount Percentages

| Account Type | Discount % at Checkout |
|---|---|
| `standard` | 0% (no discount) |
| `school_partner` | **15%** |
| `title1_partner` | **20%** |
| `wholesale` | **TBD** (not yet active, will be a percentage) |

## 2. Stacking Rules

**Option A selected:** Best single discount wins — `max(account_type %, lifetime 10%, promo code)`. No stacking.

## 3. Display Labels

- school_partner: "School Partner 15% Off"
- title1_partner: "Title I Partner 20% Off"

## 4. Additional Rules

- **No minimum order amount**
- **Applies to seedling subtotal only** (not shipping)
- **No new account types planned yet**
