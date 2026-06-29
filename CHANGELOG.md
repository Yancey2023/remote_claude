# Changelog



### Bug Fixes

- Bind registration tokens to device_id to prevent reuse

- Token invalidation on password change (token_version)

- Critical auth bypasses in WebSocket handlers


### Documentation

- Remove hardcoded test counts from CLAUDE.md and README.md


### Miscellaneous

- Bump version to 1.2.1


### Testing

- Add permission-related tests and cover missing scenarios


### Bug Fixes

- Recreate client dummy in final build step too

- Docker build needs dummy main.rs for all workspace members

- Use easingthemes/ssh-deploy@v5.1.1 instead of @v5

- Docker build needs all workspace member Cargo.tomls

- Compile-time VITE_CLIENT_VERSION injection verified

- Use hardcoded version fallback 1.1.0 instead of 0.0.0

- Workspace target path in CI/CD workflows

- Only link the Devices page text in download help

- Update download help for device name + token flow

- Download page shows correct run command per actual file

- Real-time terminal indicator reflects device offline status

- Install ring crypto provider explicitly to resolve rustls panic

- Switch from native-tls to rustls for Linux compatibility

- Mobile topbar always shows Remote Claude, device name only in sidebar

- Add missing username field in DeviceCard test mock data

- Add logo-text spacing and use solid Linux icon

- Show platform-specific run command in download help

- Stabilize t function references in useI18n to prevent infinite re-fetch

- Save image in workspace instead of /tmp for SCP access

- Load image into local Docker after build for save/SCP

- Use short SHA for image tag in save step

- Use appleboy/scp-action@v0.1.7 instead of invalid @v0

- Use latest tag for Docker Hub, add sudo to server commands

- Use sudo for docker commands on deploy

- Use SSH key auth instead of password for deploy

- Correct client binary path in Docker build

- Rename Docker Hub image to remote-claude

- Add ?mode=rwc to default sqlite database_url

- Build desktop-client on ubuntu:22.04 for glibc 2.35 compatibility


### CI/CD

- Fix aarch64 musl build by installing C cross-compiler for ring

- Switch Docker builds to musl targets

- Switch Linux builds to musl target for full static linking

- Add path-based triggers to all workflows

- Add SSH deploy step after Docker push

- Switch Docker publish target from ghcr.io to Docker Hub

- Remove build artifacts from release workflow


### Documentation

- Update tag reference from main to latest in CLAUDE.md

- Hardcode yanceyawa/remote-claude in README Docker section

- Update CHANGELOG.md [skip ci]


### Features

- Add links to Devices page from download help

- Fetch real file sizes from server, fallback to 0

- Prompt for device name before client token on first launch

- Add joystick scroll for mobile terminal users

- Add --permission-mode auto to claude launch

- Add visual directory browser and recent paths for session creation

- Use Simple Icons SVG brand logos for platforms

- Use proper platform display names (Windows/MacOS/Linux) and sort order

- Replace emoji platform icons with SVG logos

- Add manual OS tab switcher to download help command

- Add Windows ARM64 desktop-client build

- Add ARM64 support for desktop-client CI builds

- Cross-compile Windows x64 desktop-client in Docker build

- Add desktop client download feature to web UI


### Miscellaneous

- Bump version to 1.2.0

- Adapt to updated pnpm dependencies

- Migrate xterm to scoped @xterm/ packages

- Update GitHub Actions to latest versions

- Use build-time CLIENT_VERSION, simplify download help

- Derive client_version from CARGO_PKG_VERSION at compile time

- Stop persisting client_version to config file

- Replace remaining old name refs, add config file migration

- Restructure project directory and rename packages

- Reorder desktop-client build matrix

- Replace N+1 queries with SQL JOINs for username/device_name

- Remove macOS x64, keep macOS ARM64 only

- Reorder OS tabs to Windows → macOS → Linux

- Remove down arrow from download button

- Use macos-latest for darwin-arm64 runner

- Set MACOSX_DEPLOYMENT_TARGET=11.0 for macOS desktop-client builds

- Use ubuntu-22.04 runners for Linux desktop-client builds

- Rename SSH secrets to REMOTE_HOST/REMOTE_USER/ACCESS_TOKEN

- Remove VOLUME declaration for /app/downloads


### Refactoring

- Hardcode download list instead of fetching from server

- Build desktop-client in CI matrix instead of Dockerfile

- Remove docker-compose.yml, add compose example to README

- Consolidate to single root Dockerfile, remove unused Docker configs


### Bug Fixes

- Update job names and caching keys to use short target identifiers for relay-server and desktop-client

- Device status indicator and session persistence on disconnect

- Eliminate compiler warnings and dead code


### Documentation

- Update CHANGELOG.md [skip ci]


### Features

- Add program selection for terminal sessions and update related payloads

- Admin panel, change password, i18n fixes, and token delete UI fix


### Miscellaneous

- Bump version to 1.1.0 for release

- Comprehensive performance optimization across all three projects

- Reduce unnecessary re-renders and pause polling when tab is hidden


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


