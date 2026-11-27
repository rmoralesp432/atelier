# Packaging-only revision of frozen 711a8cf

Prepared November 26, 2026. The runtime, server, tests, dependencies and CI workflow are byte-for-byte unchanged from `711a8cff9eb54a4c5254e5c20187b7b2614020da`. The original commit stays frozen; this is a separate release-packaging branch. It excludes the design-decision milestone and iPhone `509e157`. No paid API calls, merge or deployment.

## Change and evidence policy

Seven authored evaluation utilities are formatted. Each revised file exactly equals the repository Prettier output of its frozen original; this equality was checked programmatically. No manual code changes were made.

129 historical evaluation snapshots (125 documents/results and four captured input fixtures) are listed individually in `.prettierignore`. Their original bytes are preserved and hashed in [preserved-files.json](preserved-files.json). These are the exact existing files identified by the prior formatting failure; no new directory-wide exception, source exemption or exemption for future reports is added. Historical failures and spending records are untouched.

The prior 136-file formatting failure is therefore resolved without rewriting captured results. Repository formatting passes locally. The existing required CI workflow is run on the release head: validation (unit tests, build, formatting), all eight browser shards, and the aggregate `check` job. CI results are linked from this branch's review PR; a running or missing check is not a pass.

This revision does not change modeling or verification behavior. Deployment remains a separate decision.

Preparation note: an attempted emitted-JavaScript comparison could not run because the installed TypeScript 7 package does not expose the older `transpile` API. That failed diagnostic is not a passing check. The formatter-output comparison above replaced it, and the earlier wording claiming successful transpilation was corrected before opening the release review.
