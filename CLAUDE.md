# Project rules

## Language

- Commit messages, pull request titles and descriptions, the README and the GitHub repository description must be written in English. Exception: a reader contribution PR body quotes the post's own title and excerpt, which may be Chinese; its PR title uses the slug because merge commits copy the PR title.
- Site content (posts, notes, page UI) stays in Chinese unless asked otherwise.
- Enforced by `.githooks/commit-msg` and `.github/workflows/commit-lang.yml`, both through `scripts/check-commit-lang.mjs`. Do not bypass the hook with `--no-verify`.
- Commit format: `<type>(<scope>): <description>`, for example `fix(site): enlarge the browser favicon glyph`.
