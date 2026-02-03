# Testing Checklist Template

Copy this for each feature batch.

---

## Testing Checklist - [Feature Name]
Date: [Date]
Batch: [HIGH/MEDIUM/LOW] Priority Issues

### Setup
- [ ] Clear browser cache
- [ ] Log in as admin at deux.atlurbanfarms.com/admin
- [ ] Have test customer account ready
- [ ] Ensure test mode active for payments (if applicable)

### Test Cases
- [ ] Test case 1: [Description]
  - Steps:
  - Expected:
  - Actual:
- [ ] Test case 2: [Description]
  - Steps:
  - Expected:
  - Actual:
- [ ] Test case 3: [Description]
  - Steps:
  - Expected:
  - Actual:

### Edge Cases
- [ ] Invalid input handling
- [ ] Error message display
- [ ] Empty states
- [ ] Mobile responsiveness
- [ ] Guest vs authenticated user

### Admin Panel Verification
- [ ] Data displays correctly in admin tables
- [ ] Edit functionality works
- [ ] Delete/archive functionality works
- [ ] Search/filter functions correctly
- [ ] Pagination works

### Customer-Facing Verification
- [ ] Product displays correctly
- [ ] Add to cart works
- [ ] Cart updates properly
- [ ] Checkout flow completes
- [ ] Confirmation displayed

### Sign-off
- Tested by: _______________
- Date: _______________
- Issues found:
- Notes:

---

## Quick Copy Templates

### For Bug Fixes
```markdown
## Testing Checklist - [Bug Fix Name]
Date:
Batch: Bug Fix

### Verification
- [ ] Bug no longer reproducible
- [ ] Original steps now work correctly
- [ ] No regression in related features
- [ ] Error handling appropriate

### Sign-off
- Tested by:
- Date:
- Issues found:
```

### For New Features
```markdown
## Testing Checklist - [Feature Name]
Date:
Batch: Feature

### Happy Path
- [ ] Feature works as designed
- [ ] Data saves correctly
- [ ] UI feedback appropriate

### Edge Cases
- [ ] Empty state handling
- [ ] Maximum value handling
- [ ] Minimum value handling
- [ ] Special characters
- [ ] Long text/numbers

### Permissions
- [ ] Admin can access
- [ ] Customer can/cannot access (as appropriate)
- [ ] Guest can/cannot access (as appropriate)

### Sign-off
- Tested by:
- Date:
- Issues found:
```

### For Checkout Flow
```markdown
## Testing Checklist - Checkout Changes
Date:
Batch: Checkout

### Guest Checkout
- [ ] Can add items to cart
- [ ] Can enter shipping address
- [ ] Address validation works
- [ ] Can see shipping rates
- [ ] Can complete payment
- [ ] Receives confirmation email
- [ ] Order appears in admin

### Authenticated Checkout
- [ ] Can add items to cart
- [ ] Saved addresses available
- [ ] Can enter new address
- [ ] Can see shipping rates
- [ ] Can complete payment
- [ ] Receives confirmation email
- [ ] Order appears in account history
- [ ] Order appears in admin

### Sign-off
- Tested by:
- Date:
- Issues found:
```

---

## Issue Severity Guide

| Severity | Definition | Example |
|----------|------------|---------|
| **Blocker** | Cannot launch without fix | Payment doesn't process |
| **Critical** | Major feature broken | Can't complete checkout |
| **Major** | Feature partially broken | Shipping rates don't display |
| **Minor** | Cosmetic or minor UX | Button alignment off |
| **Trivial** | Very minor issue | Typo in non-critical text |

---

## Reporting Issues

When reporting issues found during testing:

1. **Screenshot** the problem
2. **Note the URL** where it occurred
3. **List exact steps** to reproduce
4. **Note browser/device** used
5. **Assign severity** using guide above

Format:
```
Issue: [Brief description]
Severity: [Blocker/Critical/Major/Minor/Trivial]
URL: [Where it happened]
Steps:
1. [Step 1]
2. [Step 2]
Browser: [Chrome/Safari/Firefox] on [Desktop/Mobile]
Screenshot: [Attached]
```
