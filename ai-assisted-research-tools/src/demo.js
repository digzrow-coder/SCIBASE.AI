import {
  createResearchWorkflowReport,
  createToolInvocation,
} from "./research-tools.js"

const manuscript = `
Methods describe a reproducible catalyst dataset collected from three labs.
Results show p < 0.01 for reaction-yield prediction.
The dataset improves catalyst screening and validation for low-data experiments.
We prove this method always generalizes to new catalyst families.
`

const library = [
  {
    id: "ref_catalyst_dataset",
    title: "Reproducible catalyst datasets for reaction modeling",
    abstract: "A benchmark of catalyst screening data with validation experiments.",
  },
  {
    id: "ref_statistics",
    title: "Effect sizes and confidence intervals in computational chemistry",
    abstract: "Guidance for reporting p-values with effect sizes and uncertainty.",
  },
  {
    id: "ref_astronomy",
    title: "Galaxy survey image calibration",
    abstract: "A telescope image calibration workflow.",
  },
]

const report = createResearchWorkflowReport({
  title: "Reusable catalyst dataset",
  abstract: "We introduce a catalyst dataset for reproducible reaction modeling.",
  manuscript,
  library,
  references: library.map(({ id, title }) => ({ id, title })),
  citations: [
    {
      source_id: "methods",
      reference_id: "ref_catalyst_dataset",
      context: "Dataset collection follows prior catalyst-screening benchmarks.",
    },
  ],
  discipline: "chemistry",
})

const invocation = createToolInvocation({
  tool: "peer-review-aid",
  input: { report_id: "demo_report" },
  user_id: "demo_user",
  project_id: "demo_project",
})

console.log(JSON.stringify({ report, invocation }, null, 2))
