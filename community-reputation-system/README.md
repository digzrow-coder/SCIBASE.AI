# Community Reputation System

Self-contained MVP module for issue #15. It models a scientific community layer for structured peer review, contributor credit, transparent reputation scoring, badges, timelines, and leaderboards.

## Capabilities

- Defines discipline-specific peer-review templates with configurable scoring criteria.
- Records public, semi-private, and anonymous reviews for projects, datasets, code, notebooks, and documents.
- Stores inline review comments with anchors for datasets, code blocks, notebooks, or documents.
- Credits contributions with CRediT taxonomy roles such as data curation, software, validation, methodology, and writing.
- Computes reputation from citations, forks, endorsements, review quality, reproducibility badges, bounty completions, and credited contributions.
- Assigns transparent badges including Trusted Reviewer, Open Science Champion, Reproducibility Verified, and Scientific Bounty Solver.
- Builds project timelines and domain-filtered leaderboards.

## Usage

```bash
cd community-reputation-system
npm test
npm run demo
npm run serve
```

```js
import {
  submitPeerReview,
  createContributionRecord,
  calculateReputationScore,
  assignBadges,
} from "./src/reputation.js";

const review = submitPeerReview({
  review_id: "review_1",
  project_id: "project_alpha",
  reviewer_id: "user_reviewer",
  target_type: "dataset",
  target_id: "dataset_1",
  mode: "anonymous",
  scores: { clarity: 5, rigor: 4, novelty: 4, reproducibility: 5 },
});

const contribution = createContributionRecord({
  contribution_id: "credit_1",
  project_id: "project_alpha",
  contributor_id: "user_reviewer",
  roles: ["Validation", "Data Curation"],
  source_type: "review",
  source_id: review.review_id,
  description: "Validated dataset metadata and reproducibility evidence.",
});

const reputation = calculateReputationScore({
  peer_reviews: [review],
  contribution_records: [contribution],
  reproducibility_badges: 1,
});

console.log(reputation);
console.log(assignBadges(reputation));
```

## Runnable Demo

`npm run demo` prints a complete community workspace with a review template,
structured peer reviews, inline comments, CRediT contribution records,
project timeline events, reputation scores, badges, and leaderboard output.

`npm run serve` starts a dependency-free local browser/API demo:

- `GET /`
- `GET /health`
- `GET /demo-community`

Example:

```bash
open http://localhost:4314/
curl http://localhost:4314/demo-community
```

## Requirement Mapping

| Issue requirement | Implementation |
| --- | --- |
| Structured peer reviews | `createReviewTemplate()` and `submitPeerReview()` support discipline templates, scoring, comments, and visibility modes. |
| Inline comments | Review comments carry anchors for documents, datasets, code blocks, notebooks, or project-level feedback. |
| Public, semi-private, anonymous modes | `submitPeerReview()` validates `public`, `semi-private`, and `anonymous`. |
| Contributor credits | `createContributionRecord()` stores timestamped records with source links and CRediT taxonomy roles. |
| Git-style project timeline | `buildProjectTimeline()` combines reviews and credits into ordered timeline events. |
| Reputation scoring | `calculateReputationScore()` returns a transparent score plus factor breakdown. |
| Badges and incentive tiers | `assignBadges()` derives reviewer, reproducibility, open science, bounty, and impact badges. |
| Leaderboards | `buildLeaderboard()` ranks users globally or by domain. |
| Local reviewer demo | `npm run demo` and `npm run serve` expose the full community/reputation workflow. |

## Verification

The test suite covers review templates, review submission, contribution credit validation, reputation scoring, badge assignment, project timelines, and domain leaderboards.
