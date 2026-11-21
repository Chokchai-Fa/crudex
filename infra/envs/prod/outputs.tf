# Output names map 1:1 to Worker env vars (database_url → DATABASE_URL) via
# .github/actions/terraform-outputs. Keep them in sync with apps/api/src/env.ts and the
# `secrets:` list in .github/workflows/deploy.yml.

output "database_url" {
  value     = module.neon_db.connection_uri
  sensitive = true
}

output "upstash_redis_rest_url" {
  value = module.upstash_redis.rest_url
}

output "upstash_redis_rest_token" {
  value     = module.upstash_redis.rest_token
  sensitive = true
}

output "queue_name" {
  value = module.queue.name
}

# Vercel Sandbox: sandboxes and snapshots are created at run time under this project
# (lib/sandbox/vercel.ts, sandbox-image scripts) — never by Terraform.
output "vercel_project_id" {
  value = module.vercel_project.id
}

output "vercel_team_id" {
  value = module.vercel_project.team_id
}

# Not secret. deploy.yml writes it into apps/api/wrangler.toml (__KV_PREVIEWS_ID__).
output "kv_previews_id" {
  value = module.kv_previews.id
}
