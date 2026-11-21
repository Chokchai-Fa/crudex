# Workers KV namespace. Binding lives in apps/api/wrangler.toml (id written in by deploy.yml).
terraform {
  required_providers {
    cloudflare = { source = "cloudflare/cloudflare" }
  }
}

variable "account_id" {
  type = string
}

variable "title" {
  type = string
}

resource "cloudflare_workers_kv_namespace" "this" {
  account_id = var.account_id
  title      = var.title
}

output "id" {
  value = cloudflare_workers_kv_namespace.this.id
}
