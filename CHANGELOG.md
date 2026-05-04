# Changelog



### Bug Fixes

- Fetch all tags and use --tag flag in git-cliff

- Checkout tag for git-cliff then switch to main for commit

- Isolate env vars in config tests and gate Path import

- Fetch tags in release workflow for git-cliff

- Set filter_commits to boolean in cliff.toml

- Avoid shorthand CSS property conflict in activeLink style

- Make create user button always clickable and show validation errors

- Show real server errors in admin page and fix test mock


### Documentation

- Update CHANGELOG.md [skip ci]

- Sync README with current API endpoints and test counts

- Add screenshots and interface preview section to README


### Features

- Add admin user management UI to web frontend

- Add git-cliff for automated changelog generation in releases

- Add meaningful artifact names to GitHub release

- Prompt for client token interactively instead of panicking when missing


### Miscellaneous

- Simplify release.yml to original + fetch-tags: true


### Refactoring

- Registration token → client token across all components


### Bug Fixes

- Restore explicit root in nginx location blocks

- SPA 404 on refresh and lost login state

- Add missing user_id field to test fixtures for DeviceResponse type

- Detect PTY child exit reliably across platforms

- Enhance Windows binary resolution with sanitization and cmd.exe wrapping

- Resolve claude binary path on Windows to handle npm .cmd shims

- Correct WebSocket URL path to include /web suffix for terminal connections

- Prevent loading state flicker during background polling

- Set BrowserRouter basename from VITE_BASE_URL for correct navigation with path prefix

- Auto-create registration token and database file on startup

- Correct nginx routing for /remote_claude path prefix

- Auto-generate registration token on first run to prevent confusing admin JWT with register token

- Auto-create SQLite database file and parent directories on startup

- Ensure /app/data directory exists in final image

- Use correct sqlx absolute path format for database_url

- Set DATABASE_URL in Dockerfile to point to /app/data volume

- Restore touch src/main.rs in Dockerfiles to force Cargo rebuild

- Align Docker builder (rust:bookworm) and runner (bookworm-slim) glibc

- Set Vite base from VITE_BASE_URL so asset paths use correct prefix

- Align test expectations with new apiBaseUrl scheme

- Remove /api prefix from API paths, now part of apiBaseUrl

- Add localStorage mock in test setup for jsdom compat

- Guard localStorage access in i18n for jsdom test env

- Specify pnpm version in CI workflow

- Add pre-auth security hardening (rate limiting, timeouts, message size limits)

- Add CSP, HttpOnly cookie auth, and HTTPS warning

- Restrict CORS to same-origin by default and disable source maps in prod

- Add IP-based login rate limiting

- Encrypt WS communication via nginx TLS reverse proxy + warn on plain WS

- Validate device registration tokens against database

- Remove terminal welcome banner on attach

- Nudge button text baseline upward

- Vertically center delete icon buttons

- Apply optical centering for button labels

- Normalize firefox button inner alignment

- Center button labels with global button alignment

- Hide terminal cursor for claude sessions

- Suppress replay-triggered terminal query input artifacts

- Sync new-session route via React Router for sidebar focus

- Route sidebar new-session to setup page and safe return on delete

- Auto-clean invalid sessions from sidebar

- Keep sidebar sessions in sync with WS and polling

- Use stable terminal font stack and improve line height

- Restore Claude terminal output and PTY sizing


### CI/CD

- Add release workflow building binaries and publishing to GitHub Releases

- Use ghcr.io image for relay-server in docker-compose

- Add web-ui deploy workflow

- Add GitHub Actions CI and relay-server Docker publish


### Documentation

- Update README with CI/CD workflows and correct test counts

- Sync README test counts and web-ui config description

- Update relay-server test count from 54 to 60 after adding registration token tests

- Fix architecture diagram alignment by using English text

- Add project README with architecture overview and setup guide


### Features

- Add token revocation with backend API and frontend delete button

- Route desktop-client through nginx for unified TLS termination

- Add Docker multi-stage build and nginx reverse proxy

- Add Docker Compose orchestration for relay-server and desktop-client

- Add Docker multi-stage build for relay-server and desktop-client

- Polish sidebar and topbar layout

- Optimize mobile responsive layout

- Add Chinese localization support for web UI

- Add new-session action in sidebar

- Replay session output history on reconnect


### Miscellaneous

- Reduce device poll interval from 5s to 30s

- Remove unnecessary touch in Dockerfile build step

- Prefix Docker image and container names with remote-claude

- Set Docker Compose project name to remote-claude

- Add AGENTS.md

- Switch sessions without full page reconnect


### Refactoring

- Rename registration_token to client_token, bind to users

- Hardcode frontend config at build time, drop runtime config.json


### Testing

- Improve coverage for token revocation, loading states, and DeviceListPage

- Add layout, session store, and mobile hook coverage


