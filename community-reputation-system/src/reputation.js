const CREDIT_ROLES = new Set([
  "conceptualization",
  "data-curation",
  "formal-analysis",
  "funding-acquisition",
  "investigation",
  "methodology",
  "project-administration",
  "resources",
  "software",
  "supervision",
  "validation",
  "visualization",
  "writing-original-draft",
  "writing-review-editing",
])

const REVIEW_MODES = new Set(["public", "semi-private", "anonymous"])
const SCORE_FIELDS = ["clarity", "rigor", "novelty", "reproducibility"]

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required`)
  }
  return value.trim()
}

function normalizeScore(value, field) {
  if (value === undefined) return undefined
  if (!Number.isFinite(value) || value < 0 || value > 5) {
    throw new Error(`${field} must be a number from 0 to 5`)
  }
  return Number(value.toFixed(2))
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value))
  if (valid.length === 0) return 0
  return Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(2))
}

export function createReviewTemplate({ discipline, criteria = SCORE_FIELDS } = {}) {
  const normalizedDiscipline = requireString(discipline, "discipline")
  return {
    template_id: `review_template_${normalizedDiscipline.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    discipline: normalizedDiscipline,
    criteria: criteria.map((criterion) => requireString(criterion, "criterion")),
    allowed_modes: [...REVIEW_MODES],
    score_range: { min: 0, max: 5 },
  }
}

export function submitPeerReview({
  review_id,
  project_id,
  reviewer_id,
  target_type,
  target_id,
  mode = "public",
  discipline = "general",
  scores = {},
  comments = [],
  created_at = new Date().toISOString(),
}) {
  if (!REVIEW_MODES.has(mode)) {
    throw new Error(`mode must be one of ${[...REVIEW_MODES].join(", ")}`)
  }

  const normalizedScores = {}
  for (const field of SCORE_FIELDS) {
    const score = normalizeScore(scores[field], `scores.${field}`)
    if (score !== undefined) normalizedScores[field] = score
  }

  return {
    review_id: requireString(review_id, "review_id"),
    project_id: requireString(project_id, "project_id"),
    reviewer_id: requireString(reviewer_id, "reviewer_id"),
    target_type: requireString(target_type, "target_type"),
    target_id: requireString(target_id, "target_id"),
    mode,
    discipline: requireString(discipline, "discipline"),
    scores: normalizedScores,
    score_average: average(Object.values(normalizedScores)),
    comments: comments.map((comment, index) => ({
      comment_id: comment.comment_id ?? `comment_${index + 1}`,
      anchor: requireString(comment.anchor ?? "project", "comment.anchor"),
      body: requireString(comment.body, "comment.body"),
      visibility: comment.visibility ?? mode,
    })),
    created_at,
    timeline_event: "peer_review_submitted",
  }
}

export function createContributionRecord({
  contribution_id,
  project_id,
  contributor_id,
  roles,
  source_type,
  source_id,
  description,
  created_at = new Date().toISOString(),
}) {
  const normalizedRoles = roles.map((role) =>
    requireString(role, "role").toLowerCase().replace(/\s+/g, "-"),
  )
  const invalidRoles = normalizedRoles.filter((role) => !CREDIT_ROLES.has(role))
  if (invalidRoles.length > 0) {
    throw new Error(`Unsupported CRediT role(s): ${invalidRoles.join(", ")}`)
  }

  return {
    contribution_id: requireString(contribution_id, "contribution_id"),
    project_id: requireString(project_id, "project_id"),
    contributor_id: requireString(contributor_id, "contributor_id"),
    roles: [...new Set(normalizedRoles)],
    source_type: requireString(source_type, "source_type"),
    source_id: requireString(source_id, "source_id"),
    description: requireString(description, "description"),
    created_at,
    timeline_event: "contribution_recorded",
  }
}

export function calculateReputationScore({
  citations = 0,
  forks = 0,
  endorsements = 0,
  peer_reviews = [],
  reproducibility_badges = 0,
  bounty_completions = 0,
  contribution_records = [],
} = {}) {
  const reviewQuality = average(peer_reviews.map((review) => review.score_average))
  const uniqueProjects = new Set(contribution_records.map((record) => record.project_id)).size
  const score =
    citations * 2 +
    forks * 3 +
    endorsements * 5 +
    reviewQuality * peer_reviews.length * 4 +
    reproducibility_badges * 20 +
    bounty_completions * 25 +
    uniqueProjects * 10 +
    contribution_records.length * 4

  return {
    score: Number(score.toFixed(2)),
    factors: {
      citations,
      forks,
      endorsements,
      review_quality: reviewQuality,
      peer_reviews_completed: peer_reviews.length,
      reproducibility_badges,
      bounty_completions,
      credited_contributions: contribution_records.length,
      unique_projects: uniqueProjects,
    },
  }
}

export function assignBadges(reputation) {
  const { factors, score } = reputation
  const badges = []
  if (factors.peer_reviews_completed >= 3 && factors.review_quality >= 4) {
    badges.push("Trusted Reviewer")
  }
  if (factors.reproducibility_badges > 0) {
    badges.push("Reproducibility Verified")
  }
  if (factors.credited_contributions >= 5 || factors.unique_projects >= 3) {
    badges.push("Open Science Champion")
  }
  if (factors.bounty_completions > 0) {
    badges.push("Scientific Bounty Solver")
  }
  if (score >= 150) {
    badges.push("High Impact Contributor")
  }
  return badges
}

export function buildProjectTimeline({ reviews = [], contributions = [] } = {}) {
  return [...reviews, ...contributions]
    .map((event) => ({
      type: event.timeline_event,
      project_id: event.project_id,
      actor_id: event.reviewer_id ?? event.contributor_id,
      target_id: event.target_id ?? event.source_id,
      created_at: event.created_at,
      summary:
        event.timeline_event === "peer_review_submitted"
          ? `${event.mode} review submitted for ${event.target_type}`
          : `${event.roles.join(", ")} contribution recorded`,
    }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export function buildLeaderboard(users, { domain, limit = 10 } = {}) {
  return users
    .filter((user) => !domain || user.domain === domain)
    .map((user) => {
      const reputation = calculateReputationScore(user.metrics)
      return {
        user_id: user.user_id,
        display_name: user.display_name,
        domain: user.domain,
        reputation_score: reputation.score,
        badges: assignBadges(reputation),
      }
    })
    .sort((a, b) => b.reputation_score - a.reputation_score || a.display_name.localeCompare(b.display_name))
    .slice(0, limit)
}
