# Revenue Infrastructure

Self-contained MVP module for issue #20. It models the first production slice of SCIBASE revenue infrastructure: tiered subscriptions, usage metering, invoices, institutional billing, and anonymized analytics licensing snapshots.

## Capabilities

- Defines tiered plans for individual, lab, and institutional customers.
- Supports monthly and annual billing cycles with volume pricing through seats, coupons, and annual discounts.
- Tracks payment providers for Stripe, PayPal, and institutional invoice flows.
- Meters AI compute and cloud resource usage through token, compute-minute, notebook-run, and API-call events.
- Generates transparent invoices that combine recurring subscriptions, billable usage, tax, and payment provider metadata.
- Produces anonymized licensing snapshots for citation networks, dataset reuse, reproducibility scores, and topic trends.
- Reports revenue health with active subscriptions, trials, monthly recurring revenue, and open invoice totals.

## Usage

```bash
cd revenue-infrastructure
npm test
```

```js
import {
  createPricingPlan,
  createSubscription,
  recordUsageEvent,
  summarizeUsage,
  generateInvoice,
} from "./src/revenue.js";

const plan = createPricingPlan({
  plan_id: "lab_pro",
  name: "Lab Pro",
  type: "lab",
  monthly_price: 299,
  included_usage: { "ai-token": 100000, "notebook-run": 50 },
});

const subscription = createSubscription({
  subscription_id: "sub_1",
  account_id: "lab_1",
  plan,
  provider: "stripe",
});

const usage = summarizeUsage(subscription, [
  recordUsageEvent({
    event_id: "usage_1",
    account_id: "lab_1",
    unit: "ai-token",
    quantity: 125000,
    unit_price: 0.002,
    source: "literature-summary",
  }),
]);

console.log(generateInvoice({
  invoice_id: "inv_1",
  subscription,
  usage_summary: usage,
  period_start: "2026-05-01",
  period_end: "2026-05-31",
}));
```

## Requirement Mapping

| Issue requirement | Implementation |
| --- | --- |
| Tiered subscription billing | `createPricingPlan()` and `createSubscription()` support individual, lab, and institution plans. |
| Monthly and annual cycles | `createSubscription()` validates monthly and annual billing, including annual discounts. |
| Volume discounts, trials, coupons | Seats, coupon percentages, and trial days are first-class subscription fields. |
| Secure payment integrations | Provider field models Stripe, PayPal, and invoice-based institutional billing. |
| Usage-based AI compute billing | `recordUsageEvent()` and `summarizeUsage()` meter AI tokens, compute minutes, notebook runs, and API calls. |
| Quotas and usage meters | Plan `included_usage` and usage summaries expose used, included, and overage amounts. |
| Invoices | `generateInvoice()` combines subscription, usage, tax, totals, and provider metadata. |
| Licensing APIs and analytics | `createLicensingSnapshot()` emits anonymized citation, dataset reuse, reproducibility, and topic metrics. |
| Revenue reporting | `evaluateRevenueHealth()` summarizes active subscriptions, trials, MRR, and open invoices. |

## Verification

The test suite covers subscription plans, annual pricing, coupons, trials, payment providers, usage metering, invoice generation, licensing snapshots, and revenue health summaries.
