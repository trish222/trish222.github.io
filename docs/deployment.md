# GitHub Pages deployment

This is a Vite app. GitHub Pages must serve the generated `dist/` folder,
not the repository root. Serving the source directly causes a blank page:
the browser cannot process the CSS import in `src/main.js`, and `/fonts/`
and `/icons/` do not resolve to files under `public/` automatically.

## Repository settings (once)

1. In **Settings → Pages → Build and deployment**, set **Source** to
   **GitHub Actions**. Do not choose “Deploy from a branch”.
2. In **Settings → Environments → github-pages**, if deployment branches
   are restricted, allow both `main` and `theme/windows98`.
3. Commit and push the deployment changes to `theme/windows98`. In the
   **Actions** tab, watch **Deploy to GitHub Pages** finish successfully.

The workflow deploys pushes to either `main` or `theme/windows98` to
the same URL, https://trish222.github.io/. The latest successful deployment
replaces the live site; branches do not have separate preview URLs.
To return to deploying only `main`, remove `theme/windows98` from the
workflow's push branches.

For a manual deployment, use **Actions → Deploy to GitHub Pages → Run
workflow** and select the desired branch. GitHub requires a manually
dispatched workflow to exist on the default branch for this UI to appear.

## Local production check

```sh
npm ci
npm run build
npm run check:build
npm run preview
```

Open the preview URL printed by Vite. The workflow installs the locked
dependencies, builds the app, checks the compiled HTML and public assets,
and uploads only `dist/` for deployment. Keep `dist/` out of Git.
Fonts, icons, and desk textures are tracked under `public/` and copied by Vite.
The root `base: '/'` is correct for this repository's user-site URL.

After deployment, hard-refresh the live page. Its HTML should reference
`/assets/index-*.js` and `/assets/index-*.css`, never `/src/main.js`.
If it still references `/src/`, check the Pages source and the most recent
deployment's branch and commit in GitHub Actions.
