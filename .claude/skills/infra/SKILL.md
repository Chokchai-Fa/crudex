---
name: infra
description: Change infrastructure for crudex — Terraform modules/outputs (Neon, Upstash, Cloudflare Queue, KV namespace, Vercel project), wrangler.toml bindings (KV, Queues, cron, vars), CI/CD workflows, manual one-time account setup (Cloudflare, HCP, Neon, Upstash, Vercel), first deploy, and free-tier limit checks. Use whenever a change touches infra/**, apps/api/wrangler.toml, .github/workflows/**, or adds/removes a cloud resource or binding.
---

# Infrastructure

Read `infra/README.md` first (manual setup, Terraform layout, troubleshooting), then the
"Infrastructure" and "CI/CD" sections of `CLAUDE.md`. This skill covers what is specific to crudex.

## Who creates what

| Resource | Created by | Notes |
|----------|-----------|-------|
| Neon project, Upstash DB, Queue `crudex-jobs` | Terraform (`neon_db`, `upstash_redis`, `queue`) | |
| KV namespace `crudex-previews` | Terraform (`kv`) | output `kv_previews_id` (not secret); `deploy.yml` writes it into `wrangler.toml` (`__KV_PREVIEWS_ID__`) |
| Vercel project `crudex` | Terraform (`vercel_project`) | outputs `vercel_project_id`, `vercel_team_id`; nothing is deployed to it |
| Vercel Hobby team + token | **Manual**, once | team id → `vercel_team_id` in `terraform.tfvars`; token → GitHub secret `VERCEL_TOKEN` (Terraform reads it as `VERCEL_API_TOKEN`) |
| Worker `app`, static assets, queue consumer, cron | `wrangler deploy` in CI | |
| HCP workspace `crudex`, Cloudflare/Neon/Upstash accounts | **Manual**, once | `infra/README.md` §1 |

Every manual step goes in `infra/README.md` §1 and its values in the secrets table.

## Task: add a Terraform resource
1. New module under `infra/modules/<name>/main.tf` with `required_providers`, variables, an `id` output.
2. Instantiate it in `infra/envs/prod/main.tf`; expose what the Worker needs in `outputs.tf`
   (`sensitive = true` for secrets). The `terraform-outputs` action exports outputs as upper-case env vars.
3. New provider → `versions.tf` (pinned `~>`), `providers.tf`, run `terraform init` to refresh
   `.terraform.lock.hcl`, and pass its credential in `ci.yml`, `deploy.yml`, `destroy.yml`, `drift.yml`.
4. New binding → `wrangler.toml`, then `pnpm --filter api wrangler types` and commit `worker-configuration.d.ts`.
5. New secret or var → follow `manage-secrets`.

## Free-tier guardrails (check on every infra change)
- Workers 100K requests/day and 10 ms CPU. KV **1K writes/day** (write per artifact, never per
  request). Queues 10K ops/day. Neon 1 GB and 5 GB egress. Upstash 500K commands/month.
- Never add anything that needs a credit card (R2, Containers, Workers Paid, Vercel Pro, GCP billing). If a feature seems to need one, stop and ask.
- If a change adds per-request cost, state the daily estimate in the PR.

## Rules
- `terraform plan` only. **Never `apply`, deploy, `wrangler delete` or `destroy`** unless the
  user explicitly asks; normal changes go PR → merge → `deploy.yml`.
- Local Terraform must match the pin in `versions.tf` (currently ~> 1.16.0).
- Commit `.terraform.lock.hcl`. Run `terraform fmt -recursive` and `terraform validate` before pushing.
- Binding and queue names in `wrangler.toml` must match `env.ts` and the Terraform names.

## Done checklist
- [ ] `terraform fmt` + `validate` pass; plan reviewed (CI comment)
- [ ] `worker-configuration.d.ts` regenerated; `env.ts` updated
- [ ] `infra/README.md` and `CLAUDE.md` updated
- [ ] Free-tier impact stated in the PR
