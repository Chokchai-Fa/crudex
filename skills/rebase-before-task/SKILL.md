---
name: rebase-before-task
description: Before each Crudex task, fetch the latest development branch, rebase the working branch and review upstream changes that affect the task.
---

# Rebase before each task

1. Inspect the current branch, index and working tree with `git status --short --branch`. Preserve any in-progress Git operation and identify its owner before attempting a new rebase.
2. Run `git fetch --prune origin`. Prefer `origin/develop` when present. Otherwise resolve the remote’s advertised default with `git ls-remote --symref origin HEAD` and use its fetched tracking branch. If the fetch fails, report the failure before working from a stale base.
3. Review incoming commits with `git log --oneline HEAD..<base>` and changed paths with `git diff --stat HEAD...<base>`. If `git merge-base --is-ancestor <base> HEAD` succeeds, the branch already contains the fetched base. Continue directly to the context review.
4. Otherwise rebase the current task branch with `git rebase <base>`. For a dirty tree, first save tracked and untracked work with a named `git stash push --include-untracked` and record its exact stash object ID. After the rebase, use `git stash apply --index <saved-id>` to restore the original work. Resolve overlapping edits using both versions. Verify files and staging against the original status before dropping the matching stash entry. Preserve the backup if a conflict needs the user's judgment.
5. Confirm the fetched base is an ancestor of HEAD and inspect the resulting working tree. Read the current repository instructions, then the upstream diffs, docs and code relevant to the request before planning or editing. The sync is local. Publishing changes requires its own authorization.
