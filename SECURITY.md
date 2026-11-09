# Security policy

## Reporting a vulnerability

Please **don't open a public issue** for security problems.

Report them privately through GitHub instead: go to the repository's
**Security** tab and choose **Report a vulnerability**. Include what you
found, how to reproduce it, and what impact you think it has.

You should get a reply within a week. Once a fix is ready, we'll credit you
in the release notes unless you'd rather stay anonymous.

## Supported versions

Only the latest version on the `main` branch (published at
<https://kayepaz.github.io/B2B-web-app/>) receives security fixes.

## Security approach

The project keeps its attack surface small on purpose:

- **No runtime dependencies.** The app is plain HTML, CSS and JavaScript,
  with no npm packages, frameworks or build step. The data generator uses
  only the Python standard library.
- **Content Security Policy** in `app/index.html` only allows scripts,
  styles, images and data from the app's own origin. No inline scripts.
- **No `innerHTML`.** All text is added to the page as text
  (`app/js/dom.js`), so data can't inject HTML or scripts.
- **Pinned workflow Actions.** GitHub Actions are pinned to exact commits
  and kept current by Dependabot. Workflows request minimal permissions.
- **CodeQL** scans the JavaScript, Python and workflows on every pull
  request and weekly.

## Known limitations of this demo

- **Sign-in is a stub.** Anyone can pick any sample user; there is no
  authentication until Microsoft Entra SSO is added.
- **Data is stored in the browser** (IndexedDB) and isn't encrypted or
  synced. Clearing site data deletes carts and Order Requests.
- **Sending Order Requests is simulated** (`app/js/api.js`).
