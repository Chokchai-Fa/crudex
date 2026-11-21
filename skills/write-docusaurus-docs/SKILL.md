---
name: write-docusaurus-docs
description: Use when writing, moving or updating published Crudex product guides, API documentation, architecture pages or database references in Docusaurus.
---

# Write Crudex documentation

1. Find the reader’s workflow in `docs/site/sidebars.js`. Update the existing page under `docs/site/docs/` when it already covers the question. Place a new page alongside the related guides, give it one descriptive H1 and add its document ID (the path without the extension) to the sidebar.
2. Verify commands, routes, permissions and examples against the implementation. Use synthetic school records. Distinguish demo gateway behavior from the school API. Keep the downloadable contract in `docs/site/static/openapi.yaml` aligned with API changes.
3. Link to another handbook page by its relative Markdown filename. Link to repository-only code, original design exports and runbooks with a GitHub URL. Link API readers to `reference/openapi.mdx` so they can browse or download the same contract. In React components resolve public files from `docs/site/static/` with `useBaseUrl`. Write architecture diagrams as fenced Mermaid blocks, check their relationships against service bindings and handlers, and verify the rendered diagram in the local preview. Keep an existing published slug when reorganizing a page, and update incoming repository links if its source path changes.
4. Use Node from `.nvmrc` and run `pnpm --dir docs/site install --frozen-lockfile`. Run `pnpm --dir docs/site start` to preview at `http://localhost:3000/crudex/`. Run `pnpm --dir docs/site build` and `pnpm format:check` before submitting. Check changed navigation, diagrams and downloads in the preview.
5. Submit source and any intentional dependency lockfile changes. GitHub Actions builds the site on the PR and publishes the static artifact to GitHub Pages after merge to main.
