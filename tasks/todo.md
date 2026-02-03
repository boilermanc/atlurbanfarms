# ATL Urban Farms - Task Tracking

## Current Sprint

### In Progress
- [ ]

### Up Next
- [ ]

---

## Backlog

### High Priority
- [ ]

### Medium Priority
- [ ]

### Low Priority
- [ ]

---

## Completed
<!-- Move completed items here with date -->

---

## Working Notes
<!-- Key constraints, decisions, discovered pitfalls -->

### Key Constraints
- Weekly batch fulfillment model - Sunday 11:59 PM ET cutoff
- Live plants require special shipping considerations (no weekend delivery)
- Guest checkout must work without auth.uid()
- Address validation required before shipping rate calculation

### Active Decisions
-

### Discovered Pitfalls
- Column is `quantity_available`, not `stock_quantity`
- ShipEngine rate_id expires quickly - fetch immediately before use
- Edge function secrets must be set via CLI, not .env files
