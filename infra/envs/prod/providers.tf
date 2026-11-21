# Credentials come only from environment variables (GitHub secrets in CI, .envrc locally):
#   CLOUDFLARE_API_TOKEN, NEON_API_KEY, UPSTASH_EMAIL, UPSTASH_API_KEY, VERCEL_API_TOKEN
#   (VERCEL_API_TOKEN = GitHub secret VERCEL_TOKEN)
provider "cloudflare" {}

provider "neon" {}

provider "upstash" {}

# Hobby team (made by hand at sign-up; Terraform can't create teams). Token from VERCEL_API_TOKEN.
provider "vercel" {
  team = var.vercel_team_id
}
