# joy-jinyu.github.io

Personal site published on GitHub Pages: <https://www.pairwise.site/> (custom domain in `site/CNAME`)

| Path | Source | Notes |
| --- | --- | --- |
| `/` | `site/index.html` | Home: the Pairwise particle wordmark; links to the blog, notes and resume appear after interaction |
| `/resume/` | `site/resume/index.html` | Resume, static HTML published as is (`?theme=light` for the light theme) |
| `/notes/` | `notes/` | Tech notes, built with Astro Starlight, `base: '/notes'`; pages in `notes/src/content/docs/`, sidebar in `notes/sidebar.mjs` |
| `/blog/` | `blog/` | Blog, built with Astro + MDX, `base: '/blog'`; posts in `blog/src/content/posts/` (file name is the URL); MDX can use components from `blog/src/components/` |

## How it works

GitHub Pages serves the root of the `gh-page` branch. `deploy-gh.sh` builds the notes and the blog, assembles `site/`,
the notes and the blog output into `public/`, then creates a fresh repository there and force-pushes it to `gh-page`.
`master` holds source only; every push to `master` deploys through `.github/workflows/deploy.yml`.

## Commands

```bash
yarn            # install dependencies (also enables the commit-msg hook in .githooks/)
yarn dev        # write notes locally
yarn dev:blog   # write blog posts locally (URL printed in the terminal, path includes /blog/)
yarn deploy     # build and publish
```

## Commit messages

Commit messages must be in English. `.githooks/commit-msg` rejects messages that contain CJK characters, and the
`commit-lang` workflow checks every push and pull request to `master`. Both use `scripts/check-commit-lang.mjs`.
