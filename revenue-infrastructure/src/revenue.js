const PLAN_TYPES = new Set(["individual", "lab", "institution"])
const BILLING_CYCLES = new Set(["monthly", "annual"])
const PAYMENT_PROVIDERS = new Set(["stripe", "paypal", "invoice"])
const USAGE_UNITS = new Set(["ai-token", "compute-minute", "notebook-run", "api-call"])

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required`)
  }
  return value.trim()
}

function requireNonNegative(value, field) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative number`)
  }
  return Number(value.toFixed(4))
}

function money(value) {
  return Number(value.toFixed(2))
}

export function createPricingPlan({
  plan_id,
  name,
  type,
  monthly_price,
  annual_discount_percent = 0,
  included_usage = {},
  features = [],
}) {
  if (!PLAN_TYPES.has(type)) {
    throw new Error(`type must be one of ${[...PLAN_TYPES].join(", ")}`)
  }
  if (annual_discount_percent < 0 || annual_discount_percent > 100) {
    throw new Error("annual_discount_percent must be between 0 and 100")
  }

  return {
    plan_id: requireString(plan_id, "plan_id"),
    name: requireString(name, "name"),
    type,
    monthly_price: requireNonNegative(monthly_price, "monthly_price"),
    annual_discount_percent,
    annual_price: money(monthly_price * 12 * (1 - annual_discount_percent / 100)),
    included_usage: Object.fromEntries(
      Object.entries(included_usage).map(([unit, amount]) => {
        if (!USAGE_UNITS.has(unit)) throw new Error(`Unsupported usage unit: ${unit}`)
        return [unit, requireNonNegative(amount, `included_usage.${unit}`)]
      }),
    ),
    features: features.map((feature) => requireString(feature, "feature")),
  }
}

export function createSubscription({
  subscription_id,
  account_id,
  plan,
  cycle = "monthly",
  provider = "stripe",
  trial_days = 0,
  coupon_percent = 0,
  seats = 1,
  starts_at = new Date().toISOString(),
}) {
  if (!BILLING_CYCLES.has(cycle)) throw new Error("cycle must be monthly or annual")
  if (!PAYMENT_PROVIDERS.has(provider)) {
    throw new Error(`provider must be one of ${[...PAYMENT_PROVIDERS].join(", ")}`)
  }
  if (coupon_percent < 0 || coupon_percent > 100) {
    throw new Error("coupon_percent must be between 0 and 100")
  }
  if (!Number.isInteger(seats) || seats < 1) throw new Error("seats must be a positive integer")

  const base = cycle === "annual" ? plan.annual_price : plan.monthly_price
  const subtotal = base * seats
  const discount = subtotal * (coupon_percent / 100)

  return {
    subscription_id: requireString(subscription_id, "subscription_id"),
    account_id: requireString(account_id, "account_id"),
    plan_id: plan.plan_id,
    plan_type: plan.type,
    cycle,
    provider,
    seats,
    trial_days: requireNonNegative(trial_days, "trial_days"),
    starts_at,
    subtotal: money(subtotal),
    discount: money(discount),
    recurring_total: money(subtotal - discount),
    included_usage: { ...plan.included_usage },
    status: trial_days > 0 ? "trialing" : "active",
  }
}

export function recordUsageEvent({
  event_id,
  account_id,
  unit,
  quantity,
  unit_price,
  source,
  metadata = {},
  occurred_at = new Date().toISOString(),
}) {
  if (!USAGE_UNITS.has(unit)) throw new Error(`Unsupported usage unit: ${unit}`)
  return {
    event_id: requireString(event_id, "event_id"),
    account_id: requireString(account_id, "account_id"),
    unit,
    quantity: requireNonNegative(quantity, "quantity"),
    unit_price: requireNonNegative(unit_price, "unit_price"),
    source: requireString(source, "source"),
    metadata,
    occurred_at,
    billable_amount: money(quantity * unit_price),
  }
}

export function summarizeUsage(subscription, events) {
  const accountEvents = events.filter((event) => event.account_id === subscription.account_id)
  const byUnit = {}
  for (const event of accountEvents) {
    const bucket = byUnit[event.unit] ?? {
      used: 0,
      included: subscription.included_usage[event.unit] ?? 0,
      overage: 0,
      billable_amount: 0,
    }
    bucket.used += event.quantity
    bucket.billable_amount += event.billable_amount
    byUnit[event.unit] = bucket
  }

  for (const bucket of Object.values(byUnit)) {
    bucket.used = requireNonNegative(bucket.used, "used")
    bucket.overage = requireNonNegative(Math.max(0, bucket.used - bucket.included), "overage")
    bucket.billable_amount = money(bucket.billable_amount)
  }

  return byUnit
}

export function generateInvoice({
  invoice_id,
  subscription,
  usage_summary,
  period_start,
  period_end,
  tax_percent = 0,
}) {
  const usage_total = money(
    Object.values(usage_summary).reduce((sum, bucket) => sum + bucket.billable_amount, 0),
  )
  const subtotal = money(subscription.recurring_total + usage_total)
  const tax = money(subtotal * (tax_percent / 100))
  return {
    invoice_id: requireString(invoice_id, "invoice_id"),
    account_id: subscription.account_id,
    subscription_id: subscription.subscription_id,
    provider: subscription.provider,
    period_start: requireString(period_start, "period_start"),
    period_end: requireString(period_end, "period_end"),
    line_items: [
      {
        description: `${subscription.plan_type} ${subscription.cycle} subscription`,
        amount: subscription.recurring_total,
      },
      ...Object.entries(usage_summary).map(([unit, bucket]) => ({
        description: `${unit} usage (${bucket.used} used, ${bucket.overage} over included quota)`,
        amount: bucket.billable_amount,
      })),
    ],
    subtotal,
    tax,
    total: money(subtotal + tax),
    status: "open",
  }
}

export function createLicensingSnapshot({
  snapshot_id,
  account_id,
  citation_edges = [],
  dataset_reuse_events = [],
  reproducibility_scores = [],
  topic_counts = {},
  generated_at = new Date().toISOString(),
}) {
  const averageReproducibility =
    reproducibility_scores.length === 0
      ? 0
      : money(reproducibility_scores.reduce((sum, score) => sum + score, 0) / reproducibility_scores.length)

  return {
    snapshot_id: requireString(snapshot_id, "snapshot_id"),
    account_id: requireString(account_id, "account_id"),
    generated_at,
    anonymized: true,
    metrics: {
      citation_edges: citation_edges.length,
      dataset_reuse_events: dataset_reuse_events.length,
      average_reproducibility: averageReproducibility,
      topic_counts: { ...topic_counts },
    },
    licenseable_products: [
      "citation-network-api",
      "dataset-reuse-dashboard",
      "reproducibility-score-feed",
      "topic-trend-export",
    ],
  }
}

export function evaluateRevenueHealth({ subscriptions = [], invoices = [] } = {}) {
  const monthlyRecurringRevenue = subscriptions.reduce((sum, subscription) => {
    const normalized = subscription.cycle === "annual" ? subscription.recurring_total / 12 : subscription.recurring_total
    return sum + normalized
  }, 0)
  const openInvoiceTotal = invoices
    .filter((invoice) => invoice.status === "open")
    .reduce((sum, invoice) => sum + invoice.total, 0)

  return {
    active_subscriptions: subscriptions.filter((subscription) => subscription.status === "active").length,
    trialing_subscriptions: subscriptions.filter((subscription) => subscription.status === "trialing").length,
    monthly_recurring_revenue: money(monthlyRecurringRevenue),
    open_invoice_total: money(openInvoiceTotal),
  }
}
