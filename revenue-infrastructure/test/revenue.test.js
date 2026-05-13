import assert from "node:assert/strict"
import test from "node:test"
import {
  createLicensingSnapshot,
  createPricingPlan,
  createSubscription,
  evaluateRevenueHealth,
  generateInvoice,
  recordUsageEvent,
  summarizeUsage,
} from "../src/revenue.js"

test("creates tiered subscription plans with annual pricing and quotas", () => {
  const plan = createPricingPlan({
    plan_id: "lab_pro",
    name: "Lab Pro",
    type: "lab",
    monthly_price: 299,
    annual_discount_percent: 15,
    included_usage: { "ai-token": 100000, "notebook-run": 50 },
    features: ["shared projects", "priority support", "private data spaces"],
  })

  assert.equal(plan.annual_price, 3049.8)
  assert.equal(plan.included_usage["ai-token"], 100000)
  assert.throws(
    () =>
      createPricingPlan({
        plan_id: "bad",
        name: "Bad",
        type: "lab",
        monthly_price: 1,
        included_usage: { unknown: 1 },
      }),
    /Unsupported usage unit/,
  )
})

test("builds subscriptions across providers with seats, coupons, and trials", () => {
  const plan = createPricingPlan({
    plan_id: "institution",
    name: "Institution",
    type: "institution",
    monthly_price: 1200,
    annual_discount_percent: 20,
  })
  const subscription = createSubscription({
    subscription_id: "sub_1",
    account_id: "university_1",
    plan,
    cycle: "annual",
    provider: "invoice",
    seats: 3,
    coupon_percent: 10,
    trial_days: 14,
  })

  assert.equal(subscription.status, "trialing")
  assert.equal(subscription.recurring_total, 31104)
  assert.equal(subscription.provider, "invoice")
})

test("meters AI compute and generates transparent invoices", () => {
  const plan = createPricingPlan({
    plan_id: "individual_pro",
    name: "Individual Pro",
    type: "individual",
    monthly_price: 39,
    included_usage: { "ai-token": 1000, "compute-minute": 10 },
  })
  const subscription = createSubscription({
    subscription_id: "sub_2",
    account_id: "researcher_1",
    plan,
    provider: "stripe",
  })
  const events = [
    recordUsageEvent({
      event_id: "usage_1",
      account_id: "researcher_1",
      unit: "ai-token",
      quantity: 1250,
      unit_price: 0.002,
      source: "literature-summary",
    }),
    recordUsageEvent({
      event_id: "usage_2",
      account_id: "researcher_1",
      unit: "compute-minute",
      quantity: 12,
      unit_price: 0.5,
      source: "notebook-execution",
    }),
  ]

  const usage = summarizeUsage(subscription, events)
  assert.equal(usage["ai-token"].overage, 250)
  assert.equal(usage["compute-minute"].overage, 2)

  const invoice = generateInvoice({
    invoice_id: "inv_1",
    subscription,
    usage_summary: usage,
    period_start: "2026-05-01",
    period_end: "2026-05-31",
    tax_percent: 5,
  })

  assert.equal(invoice.subtotal, 47.5)
  assert.equal(invoice.tax, 2.38)
  assert.equal(invoice.total, 49.88)
  assert.equal(invoice.line_items.length, 3)
})

test("produces anonymized licensing snapshots for analytics products", () => {
  const snapshot = createLicensingSnapshot({
    snapshot_id: "snapshot_1",
    account_id: "consortium_1",
    citation_edges: [{ from: "paper_a", to: "paper_b" }],
    dataset_reuse_events: [{ dataset: "ds_1", project: "p_1" }],
    reproducibility_scores: [80, 90, 100],
    topic_counts: { genomics: 12, robotics: 3 },
  })

  assert.equal(snapshot.anonymized, true)
  assert.equal(snapshot.metrics.average_reproducibility, 90)
  assert.ok(snapshot.licenseable_products.includes("citation-network-api"))
})

test("summarizes recurring revenue and open invoice totals", () => {
  const individual = createPricingPlan({
    plan_id: "individual",
    name: "Individual",
    type: "individual",
    monthly_price: 25,
  })
  const lab = createPricingPlan({
    plan_id: "lab",
    name: "Lab",
    type: "lab",
    monthly_price: 300,
    annual_discount_percent: 10,
  })
  const subscriptions = [
    createSubscription({
      subscription_id: "sub_a",
      account_id: "user_a",
      plan: individual,
    }),
    createSubscription({
      subscription_id: "sub_b",
      account_id: "lab_b",
      plan: lab,
      cycle: "annual",
    }),
  ]
  const invoices = [
    { status: "open", total: 99.5 },
    { status: "paid", total: 25 },
  ]

  const health = evaluateRevenueHealth({ subscriptions, invoices })
  assert.equal(health.active_subscriptions, 2)
  assert.equal(health.monthly_recurring_revenue, 295)
  assert.equal(health.open_invoice_total, 99.5)
})
