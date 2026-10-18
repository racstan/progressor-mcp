# Billing page

## Tasks

- [x] Create Stripe customers ^t1
  - summary: Create a Stripe customer on sign-up and store its ID on the account.
  - code: `src/billing/customers.ts`
- [x] Plans and prices table ^t2
  - summary: Seed the plans and prices from config so test and live stay in step.
  - code: `src/billing/plans.ts`
- [/] Checkout flow ^t3
  - summary: Redirect to Stripe Checkout and confirm the subscription on return.
  - code: `src/billing/checkout.tsx`
- [ ] Webhooks ^t4
  - summary: Handle subscription updates and failed payments from Stripe's webhooks.
  - code: `src/billing/webhooks.ts`
- [ ] Pricing table redesign ^t5
  - summary: Restyle the pricing table with the new plan cards.
  - code: `src/billing/PricingTable.tsx`
  - added by: ^d1

## Detour: Pricing table redesign ^d1

- branched from: ^t3
- reason: The Agent started restyling the pricing table while wiring checkout; the Developer chose to return to the plan
- status: returned
