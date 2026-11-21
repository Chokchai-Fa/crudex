#!/usr/bin/env bash
# Turns a fresh copy of this template into your project, in one go:
#   app-template    → <project-name>        (resource names, HCP workspace, queue, UI title)
#   your-subdomain  → <workers-subdomain>   (APP_URL = https://app.<subdomain>.workers.dev)
#   your-hcp-org    → <hcp-organization>    (infra/envs/prod/versions.tf)
#
# Usage: scripts/init-template.sh <project-name> <workers-subdomain> <hcp-organization>
# Run it once, from the repo root, on a clean working tree; review with `git diff`.
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <project-name> <workers-subdomain> <hcp-organization>" >&2
  exit 2
fi
name=$1 subdomain=$2 org=$3

# Cloud resource names: lowercase letters, digits and hyphens, starting with a letter.
for value in "$name" "$subdomain"; do
  if [[ ! $value =~ ^[a-z][a-z0-9-]{1,40}$ ]]; then
    echo "'$value' must be lowercase letters, digits and hyphens, starting with a letter." >&2
    exit 2
  fi
done
if [[ ! $org =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "'$org' is not a valid HCP Terraform organization name." >&2
  exit 2
fi

cd "$(git rev-parse --show-toplevel)"
if [[ -n $(git status --porcelain) ]]; then
  echo "Commit or stash your changes first, so the rename is one reviewable diff." >&2
  exit 1
fi
if ! git grep -q 'app-template' -- . ':!scripts/init-template.sh'; then
  echo "Nothing to rename — this copy was already initialised." >&2
  exit 1
fi

# Tracked text files only; lockfiles and this script are left alone.
git grep -lzI -e 'app-template' -e 'your-subdomain' -e 'your-hcp-org' -- . \
  ':!scripts/init-template.sh' ':!pnpm-lock.yaml' ':!**/.terraform.lock.hcl' |
  xargs -0 sed -i.bak -e "s/app-template/${name}/g" -e "s/your-subdomain/${subdomain}/g" \
    -e "s/your-hcp-org/${org}/g"
find . -name '*.bak' -not -path './node_modules/*' -delete

echo "Renamed to '${name}' (https://app.${subdomain}.workers.dev, HCP org '${org}')."
echo "Next: set neon_org_id in infra/envs/prod/terraform.tfvars, review 'git diff', commit."
