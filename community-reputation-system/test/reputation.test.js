import assert from "node:assert/strict"
import test from "node:test"
import {
  assignBadges,
  buildLeaderboard,
  buildProjectTimeline,
  calculateReputationScore,
  createContributionRecord,
  createReviewTemplate,
  submitPeerReview,
} from "../src/reputation.js"

test("creates discipline review templates and structured peer reviews", () => {
  const template = createReviewTemplate({ discipline: "Biology" })
  assert.equal(template.template_id, "review_template_biology")
  assert.deepEqual(template.criteria, ["clarity", "rigor", "novelty", "reproducibility"])

  const review = submitPeerReview({
    review_id: "review_1",
    project_id: "project_alpha",
    reviewer_id: "user_reviewer",
    target_type: "dataset",
    target_id: "dataset_1",
    mode: "anonymous",
    discipline: "Biology",
    scores: { clarity: 5, rigor: 4, novelty: 3, reproducibility: 4 },
    comments: [{ anchor: "dataset.rows[12]", body: "Replicate count needs explanation." }],
    created_at: "2026-05-13T10:00:00.000Z",
  })

  assert.equal(review.score_average, 4)
  assert.equal(review.comments[0].visibility, "anonymous")
  assert.equal(review.timeline_event, "peer_review_submitted")
})

test("records contributor credits with CRediT taxonomy roles", () => {
  const contribution = createContributionRecord({
    contribution_id: "credit_1",
    project_id: "project_alpha",
    contributor_id: "user_data",
    roles: ["Data Curation", "Software", "Software"],
    source_type: "commit",
    source_id: "abc123",
    description: "Added reproducible cleaning notebook and dataset manifest.",
    created_at: "2026-05-13T11:00:00.000Z",
  })

  assert.deepEqual(contribution.roles, ["data-curation", "software"])
  assert.equal(contribution.timeline_event, "contribution_recorded")
  assert.throws(
    () =>
      createContributionRecord({
        contribution_id: "bad",
        project_id: "project_alpha",
        contributor_id: "user_data",
        roles: ["made-up-role"],
        source_type: "commit",
        source_id: "abc124",
        description: "Invalid role.",
      }),
    /Unsupported CRediT role/,
  )
})

test("calculates transparent reputation factors and assigns badges", () => {
  const reviews = [
    submitPeerReview({
      review_id: "review_1",
      project_id: "project_alpha",
      reviewer_id: "user_reviewer",
      target_type: "notebook",
      target_id: "nb_1",
      scores: { clarity: 5, rigor: 5, novelty: 4, reproducibility: 5 },
    }),
    submitPeerReview({
      review_id: "review_2",
      project_id: "project_beta",
      reviewer_id: "user_reviewer",
      target_type: "dataset",
      target_id: "ds_1",
      scores: { clarity: 4, rigor: 4, novelty: 4, reproducibility: 4 },
    }),
    submitPeerReview({
      review_id: "review_3",
      project_id: "project_gamma",
      reviewer_id: "user_reviewer",
      target_type: "code",
      target_id: "repo_1",
      scores: { clarity: 5, rigor: 4, novelty: 4, reproducibility: 5 },
    }),
  ]
  const contribution_records = ["a", "b", "c", "d", "e"].map((id, index) =>
    createContributionRecord({
      contribution_id: `credit_${id}`,
      project_id: `project_${index % 3}`,
      contributor_id: "user_reviewer",
      roles: ["Validation"],
      source_type: "review",
      source_id: `review_${id}`,
      description: "Validated reproducibility evidence.",
    }),
  )

  const reputation = calculateReputationScore({
    citations: 4,
    forks: 2,
    endorsements: 3,
    peer_reviews: reviews,
    reproducibility_badges: 1,
    bounty_completions: 1,
    contribution_records,
  })

  assert.equal(reputation.factors.peer_reviews_completed, 3)
  assert.equal(reputation.factors.unique_projects, 3)
  assert.ok(reputation.score > 100)
  assert.deepEqual(assignBadges(reputation), [
    "Trusted Reviewer",
    "Reproducibility Verified",
    "Open Science Champion",
    "Scientific Bounty Solver",
    "High Impact Contributor",
  ])
})

test("builds project timelines and domain leaderboards", () => {
  const review = submitPeerReview({
    review_id: "review_1",
    project_id: "project_alpha",
    reviewer_id: "ada",
    target_type: "paper",
    target_id: "paper_1",
    scores: { clarity: 4, rigor: 5 },
    created_at: "2026-05-13T12:00:00.000Z",
  })
  const contribution = createContributionRecord({
    contribution_id: "credit_1",
    project_id: "project_alpha",
    contributor_id: "grace",
    roles: ["Software"],
    source_type: "commit",
    source_id: "def456",
    description: "Added analysis workflow.",
    created_at: "2026-05-13T09:00:00.000Z",
  })

  const timeline = buildProjectTimeline({ reviews: [review], contributions: [contribution] })
  assert.deepEqual(
    timeline.map((event) => event.actor_id),
    ["grace", "ada"],
  )

  const leaderboard = buildLeaderboard(
    [
      {
        user_id: "ada",
        display_name: "Ada",
        domain: "biology",
        metrics: { citations: 10, peer_reviews: [review], contribution_records: [contribution] },
      },
      {
        user_id: "grace",
        display_name: "Grace",
        domain: "physics",
        metrics: { citations: 1, forks: 1 },
      },
    ],
    { domain: "biology" },
  )

  assert.equal(leaderboard.length, 1)
  assert.equal(leaderboard[0].user_id, "ada")
})
