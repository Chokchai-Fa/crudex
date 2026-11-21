# Empty Vercel project that owns our Vercel Sandboxes and snapshots (Hobby plan, no card).
# Nothing is deployed to it: no git link, no framework. Sandboxes themselves are short-lived
# and created at run time with @vercel/sandbox, not by Terraform.
terraform {
  required_providers {
    vercel = { source = "vercel/vercel" }
  }
}

variable "name" {
  type = string
}

resource "vercel_project" "this" {
  name = var.name
}

output "id" {
  value = vercel_project.this.id
}

output "team_id" {
  value = vercel_project.this.team_id
}
