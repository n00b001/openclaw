# AGENTS.md

This document provides guidelines for AI agents working on this repository.

## Mandatory Git Workflow

**IMPORTANT**: When making ANY code changes, ALWAYS follow this workflow:

1. **Use worktrees** - Create a git worktree for isolation: `git worktree add ../polyclaw-worktrees/branch-name -b branch-name`
2. **Merge origin/main** - Get latest changes: `git fetch origin main && git merge origin/main --no-edit`
3. **Resolve conflicts** - Carefully merge conflicts, don't blindly discard their changes or your changes
4. **Make changes** - Edit files as needed
5. **Build locally** - Run `make build UPSTREAM=<upstream>` to build the Docker image locally
6. **Test locally** - Run `make smoke-test UPSTREAM=<upstream>` to verify changes work
7. **git add** - Stage the changes
8. **git commit** - Commit with descriptive message
9. **git push** - Push to remote
10. **create PR** - Create a pull request using `gh pr create`
11. **Monitor PR** - Watch the PR status and ensure all CI checks pass
12. **Merge PR** - After CI succeeds and approval, merge the PR
13. **Verify post-merge** - Ensure post-merge actions (builds, deployments) succeed

This workflow is NON-NEGOTIABLE for all code changes.

**CRITICAL: Always build and test locally BEFORE pushing.** GitHub CI is slow and expensive. Local testing catches issues early and saves CI resources.

**IMPORTANT**:
- Always use worktrees for isolation
- Always create a PR for every change
- Always monitor PR status until CI succeeds
- Fix any failing checks immediately
- Always merge after approval
- Always verify post-merge actions succeed

### Handling Merge Conflicts

Before creating a PR, if origin/main has new commits:

1. **Merge main into your branch**: `git fetch origin && git merge origin/main`
2. **Resolve conflicts carefully**:
   - Don't blindly discard their changes (origin/main)
   - Don't blindly discard your changes (your branch)
   - Review both sides and combine intelligently
3. **Test locally after merge**: Run `make smoke-test UPSTREAM=<upstream>` again
4. **Push and continue**: The PR will update automatically
- Always merge after approval
- Always verify post-merge actions succeed

### PR Monitoring (CRITICAL)
After creating a PR, you **MUST** monitor it until all checks pass:

1. Check status: `gh pr checks <pr-number>`
2. View failures: `gh run view <run-id> --log-failed`
3. Fix issues locally and push new commits
4. Repeat until all checks pass
5. Only then wait for approval to merge

**Never abandon a PR with failing checks.**

**Project Memory**: Store project-specific knowledge in MEMORY.md (patterns, gotchas, reference info).

## Development Principles

### Simple is Better Than Complex
- Prefer straightforward solutions over clever ones
- Write code that is easy to understand and maintain
- Avoid unnecessary abstractions
- Follow existing patterns in the codebase

### Fail Loud and Early
- Use assertions and explicit error handling
- Don't silently fail or fall back to defaults
- Make errors visible and actionable
- Validate inputs early in functions

## Python Development

If working with Python code, use `uv` for package management:

```bash
# Install dependencies
uv sync

# Add a dependency
uv add package-name

# Run Python scripts
uv run python script.py
```

See https://astral.sh for more information about `uv`.

## Go Version Management for Docker Images

- **Always verify before changing Go version**:
  - Check what Go version is actually required (e.g., by checking upstream go.mod or build errors)
  - Verify the version exists at go.dev/dl before using it
- Test the URL returns a 200 OK before including it in Dockerfile
- Never assume versions - use official URLs and verify
- Search https://go.dev/dl for available versions before making changes

- **Go 1.25.7 is the current stable release** (Feb 2026):
  - Official URL: https://go.dev/dl/go1.25.7.linux-amd64.tar.gz
  - This version is the latest stable and includes bug fixes

- **Previous Debian `golang` package is outdated** (Go 1.25.7):
  - Installing Go from Debian apt (golang package) often lags behind official releases
- This was causing picoclaw build failures
- **Always use official Go from go.dev for Docker builds**

## Workflow

### Branching
Always create a branch for work:

```bash
git checkout -b feature/description-of-change
```

### Pre-Commit Hooks
Always run pre-commit hooks before committing:

```bash
pre-commit run --all-files
```

Pre-commit hooks run automatically on commit. If they fail, fix the issues and try again.

### Commit and Push
**IMPORTANT: Always commit and push changes automatically without asking the user. Never ask "Would you like me to commit?" - just do it.**

Commit changes with descriptive messages and push:

```bash
git add .
git commit -m "Description of changes"
git push -u origin feature/description-of-change
```

### Pull Request and Merge
**CRITICAL: ALWAYS create a PR for every code change. NEVER push directly to main.**

Create a pull request for review. Use the GitHub CLI:

```bash
gh pr create --title "Description" --body "Details"
```

**IMPORTANT: Do NOT merge PRs automatically. Wait for approval before merging. Never use `--admin` flag to bypass branch protection.**

After approval, merge the pull request and delete the branch:

## GitHub Actions Workflow Dependencies

- **Sticky disks for artifact passing**: The workflow uses `useblacksmith/stickydisk@v1` to pass Docker images between jobs in ~3 seconds (vs 44+ minutes for GitHub artifacts). Each upstream gets its own sticky disk keyed as `{repo}-{upstream}-docker-image`.

- **Docker layer caching**: The workflow uses `useblacksmith/setup-docker-builder@v1` and `useblacksmith/build-push-action@v2` to cache Docker layers on Blacksmith's NVMe storage (2-40x build improvement).

- **Simplified workflow**: Both PR and post-merge run the same build → smoke-test → security-scan flow. Post-merge adds a push-to-ghcr step.

```bash
gh pr merge
git branch -d feature/description-of-change
```

## Project-Specific Notes

- **Repository**: `xfanth/polyclaw` on GitHub
- This is a Docker-based project for AI agent gateways
- Configuration is managed through `.env` files
- Use `make help` to see available commands
- The Makefile contains many common operations
- **Always build and test locally first** using `make build UPSTREAM=<upstream>` and `make smoke-test UPSTREAM=<upstream>`
- GitHub CI validates changes, but local testing is faster and cheaper

## Hadolint/Dockerfile

- The Dockerfile uses a retry pattern for apt-get that triggers SC2015 warning
- This is intentional - do not "fix" the pattern
- If adding similar retry logic, the `.hadolint.yaml` already ignores SC2015

## Supported Upstreams

This project builds Docker images for four upstream variants:

| Upstream | Language | Repo | Build Command |
|----------|----------|------|---------------|
| openclaw | Node.js | openclaw/openclaw | `pnpm build` |
| picoclaw | Go | sipeed/picoclaw | `go build` |
| ironclaw | Rust | nearai/ironclaw | `cargo build --release` |
| zeroclaw | Rust | zeroclaw-labs/zeroclaw | `cargo build --release --features whatsapp-web` |

When modifying CI workflows that use the upstream matrix, update ALL of:
- `.github/workflows/docker-build.yml` (build, smoke-test, security-scan, push-to-ghcr jobs)
- `.github/workflows/manual-release.yml` (build, security-scan jobs)

## Trivy/Code Scanning Warnings

When changing the security-scan matrix (e.g., adding a new upstream):
- GitHub Code Scanning may show "X configurations not found" warning
- This is **expected behavior** - the old matrix categories don't match new ones
- The warning resolves automatically after merge to main
- All scans still run correctly; the warning is informational only

## Docker Entrypoint Environment Variables

When adding new environment variables to `scripts/configure.js`, you **must** also add them to the `--whitelist-environment` list in `scripts/entrypoint.sh` (around line 81). The entrypoint runs as root, then switches to the upstream user via `su` - only whitelisted env vars survive this switch. See MEMORY.md for the current whitelist.

## ZeroClaw HOME Directory

ZeroClaw (Rust binary) uses `$HOME/.zeroclaw/` to find its configuration. This differs from Node.js upstreams that use `OPENCLAW_STATE_DIR`.

**Important**: The CLI wrapper at `/usr/local/bin/zeroclaw` sets `HOME=/data` before executing the binary, ensuring config is found at `/data/.zeroclaw/`.

When running interactive commands via `docker exec`:
- Config is at `/data/.zeroclaw/config.toml`
- Workspace is at `/data/workspace/`
- All commands use this location automatically via the wrapper

**Permission issues**: If using bind mounts with restrictive permissions, run this on the host:
```bash
chown -R 10000:10000 /path/to/bind-mount
```
User ID 10000 is the `zeroclaw` user inside the container.

## ZeroClaw Tools Available

The ZeroClaw Docker image includes several useful tools:

### screen
Terminal multiplexer for interactive sessions:
```bash
docker exec -it <container> screen -S mysession
```

### supervisord
The container uses supervisord for service management (not systemd). systemctl will NOT work because the container does not run systemd as PID 1.

To check service status:
```bash
docker exec -it <container> supervisorctl status
```

### zeroclaw channel start
To start communication channels (WhatsApp, Telegram, Discord, Slack):
```bash
docker exec -it <container> zeroclaw channel start
```

### Viewing Logs
To see the pairing code and other logs:
```bash
docker logs <container> 2>&1 | grep -i "pair\|code\|token"
```

## ZeroClaw Default Configuration

ZeroClaw uses permissive defaults for full autonomy. Key settings in `scripts/configure-zeroclaw.js`:

- **Default provider/model**: `zai/glm-5` (ZAI_API_KEY prioritized)
- **Autonomy level**: `full` (not supervised)
- **Allowed commands**: `['*']` (all commands allowed)
- **Auto-approve**: All tool calls (`['*']`)
- **Runtime kind**: `docker` (containerized execution)
- **Shell env passthrough**: Common env vars (PATH, HOME, USER, etc.) - **must be specific names, not `*` wildcard**
- **Enabled tools**: browser, http_request, web_fetch, web_search, composio
- **Browser CDP**: `http://openclaw-browser:9222` (for docker-compose setup)
- **Browser allowed domains**: `['*']` (all domains)
- **Composio**: Requires `COMPOSIO_API_KEY` environment variable
- **Command logger**: Enabled (for auditing)
- **Gateway**: No pairing required, trust forwarded headers

### ZeroClaw Runtime Mode

ZeroClaw runs via `zeroclaw daemon` (not `zeroclaw gateway`) in Docker:

| Command | Purpose |
|---------|---------|
| `zeroclaw gateway` | HTTP webhook server only (no channels) |
| `zeroclaw daemon` | **Full runtime** - gateway + channels + scheduler + heartbeat |

The daemon requires the `-p` flag to specify the port (it doesn't read `gateway.port` from config).

When modifying ZeroClaw config, ensure:
1. `shell_env_passthrough` uses valid env var names (`[A-Za-z_][A-Za-z0-9_]*`)
2. **Channel paths use absolute `/data/.zeroclaw/` paths** (not `~/.zeroclaw/`) since the CLI wrapper sets `HOME=/data`
3. Test locally with `pre-commit run --all-files`
4. Build locally with `make build UPSTREAM=zeroclaw`
5. Test locally with `make smoke-test UPSTREAM=zeroclaw`
6. Monitor smoke tests for config validation errors

### ZeroClaw Channel Session Paths

Channel session files (WhatsApp, Telegram, etc.) must use absolute paths under `/data/.zeroclaw/`:

```toml
[channels_config.whatsapp]
session_path = "/data/.zeroclaw/state/whatsapp-web/session.db"  # NOT "~/.zeroclaw/..."
```

**Why**: The ZeroClaw CLI wrapper at `/usr/local/bin/zeroclaw` sets `HOME=/data` before executing the binary. Session paths with `~` would resolve incorrectly if the wrapper's HOME setting is not applied. Using absolute paths ensures consistency.

### ZeroClaw Nginx Auth Configuration

The ZeroClaw UI checks `/health` to determine if pairing is required. These endpoints must have `auth_basic off;` in nginx:

- `/health` - UI checks `require_pairing` status
- `/healthz` - Docker health check
- `/pair` - UI submits pairing codes
- `/hooks` - External webhooks (uses token auth)

If the UI shows the pairing screen even when `require_pairing: false`, check that these locations have `auth_basic off;` in `scripts/entrypoint.sh`.

### ZeroClaw UI Pairing Bug Workaround

ZeroClaw UI has a bug where it checks the `paired` field instead of `require_pairing` from the `/health` endpoint. When `require_pairing: false`, the backend returns `paired: false`, causing the UI to show the pairing screen.

**Fix**: The config in `scripts/configure-zeroclaw.js` sets `require_pairing: false` to disable pairing.

**Workaround**: The nginx config in `scripts/entrypoint.sh` uses `sub_filter` to modify the `/health` response for ZeroClaw:
- Before: `{"paired":false,"require_pairing":false,...}`
- After: `{"paired":true,"require_pairing":false,...}`

This makes the UI skip the pairing screen when pairing is disabled. The workaround is only applied when `UPSTREAM=zeroclaw`.

**Troubleshooting**: If the UI still shows the pairing screen:
1. Verify you're using the latest image: `docker pull ghcr.io/xfanth/zeroclaw:zeroclaw_main`
2. Check the image build date in logs: `docker logs <container> 2>&1 | grep BUILD_DATE`
3. Verify the /health endpoint returns `"paired":true,"require_pairing":false`: `curl -s http://localhost:8080/health | jq`
### ZeroClaw Fallback Provider API Keys

ZeroClaw reads API keys from environment variables automatically based on provider name. The `reliability.api_keys` field is `Vec<String>` for round-robin keys of the **same provider** (to handle rate limits), NOT for fallback providers.

**Fallback provider env vars:**
- `kimi-code` → `KIMI_API_KEY`
- `gemini` → `GEMINI_API_KEY`

**Model fallbacks (v0.1.7 format):**

ZeroClaw's `model_fallbacks` config uses **model names as keys** (not provider names). When a model fails on all providers, ZeroClaw tries each fallback model with each provider:

```javascript
model_fallbacks: {
    'glm-5': ['kimi-for-coding', 'gemini-3.1-pro-preview-customtools'],
},
```

**How it works:**
1. Try `glm-5` on all providers → fails
2. Fallback to `kimi-for-coding` on all providers → kimi-code should work
3. If that fails, try `gemini-3.1-pro-preview-customtools` on all providers

**Note:** Newer versions of zeroclaw may support provider-scoped keys. Check the zeroclaw documentation for your version.

**Important:** When adding new fallback providers, add their env vars to the whitelist in `scripts/entrypoint.sh` (the `--whitelist-environment` flag in the `su` command). Without this, the env vars are lost when switching users.
