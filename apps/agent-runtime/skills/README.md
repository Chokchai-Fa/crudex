# Runtime skills

Place each skill at `skills/<id>/SKILL.md`. Use lowercase letters, numbers and
hyphens in the directory ID, and put `name` and `description` in YAML frontmatter.

```markdown
---
name: Sample skill
description: Format an example response.
---

Use a short heading followed by a plain-language explanation.
```

The bundle embeds the frontmatter and Markdown body. Bind the directory ID in
the agent definition's `skills` list to grant access through OpenCode.
