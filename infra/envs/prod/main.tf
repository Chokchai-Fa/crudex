module "neon_db" {
  source    = "../../modules/neon_db"
  name      = var.project_name
  region_id = var.neon_region
  org_id    = var.neon_org_id
}

module "upstash_redis" {
  source         = "../../modules/upstash_redis"
  name           = "${var.project_name}-cache"
  primary_region = var.upstash_region
}

module "queue" {
  source     = "../../modules/queue"
  account_id = var.cloudflare_account_id
  name       = "${var.project_name}-jobs"
}

module "vercel_project" {
  source = "../../modules/vercel_project"
  name   = var.project_name
}

# Generated files (worksheet DOCX/PDF/previews), one tar per run, 7-day TTL. Free: 1K writes/day.
module "kv_previews" {
  source     = "../../modules/kv"
  account_id = var.cloudflare_account_id
  title      = "${var.project_name}-previews"
}
