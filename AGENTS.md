# AGENTS.md

This document provides guidelines for AI agents working on this repository.

## Mandatory Git Workflow

**IMPORTANT**: When making ANY code changes, ALWAYS follow this workflow:

1. **Use worktrees** - Create a git worktree for isolation: `git worktree add ../polyclaw-worktrees/branch-name -b branch-name`
2. **git pull** - Get latest changes from remote
3. **Make changes** - Edit files as needed
4. **git add** - Stage the changes
5. **git commit** - Commit with descriptive message
6. **git push** - Push to remote
7. **create PR** - Create a pull request using `gh pr create`
8. **Monitor PR** - Watch the PR status and ensure all CI checks pass
9. **Merge PR** - After CI succeeds and approval, merge the PR
10. **Verify post-merge** - Ensure post-merge actions (builds, deployments) succeed

This workflow is NON-NEGOTIABLE for all code changes.

**IMPORTANT**:
- Always use worktrees for isolation
- Always create a PR for every change
- Always monitor PR status until CI succeeds
- Fix any failing checks immediately
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

1. **Create PR**:
   ```bash
   gh pr create --title "Description" --body "Details"
   ```

2. **Monitor PR checks until they pass**:
   ```bash
   gh pr checks <pr-number>
   ```
   - If checks fail, view logs: `gh run view <run-id> --log-failed`
   - Fix issues locally, commit, and push
   - Repeat until all checks pass

3. **Wait for approval**, then merge:
   ```bash
   gh pr merge
   ```

4. **Monitor post-merge checks**:
   ```bash
   gh run list --branch main --limit 3
   gh run view <run-id>
   ```
   - If post-merge fails, fix immediately and push to main

**Never abandon a PR with failing checks. Always fix issues before moving on.**

## GitHub Actions Workflow Dependencies

- **Sticky disks for artifact passing**: The workflow uses `useblacksmith/stickydisk@v1` to pass Docker images between jobs in ~3 seconds (vs 44+ minutes for GitHub artifacts). Each upstream gets its own sticky disk keyed as `{repo}-{upstream}-docker-image`.

- **Docker layer caching**: The workflow uses `useblacksmith/setup-docker-builder@v1` and `useblacksmith/build-push-action@v2` to cache Docker layers on Blacksmith's NVMe storage (2-40x build improvement).

- **Simplified workflow**: Both PR and post-merge run the same build → smoke-test → security-scan flow. Post-merge adds a push-to-ghcr step.

## Project-Specific Notes

- **Repository**: `xfanth/polyclaw` on GitHub
- This is a Docker-based project for AI agent gateways
- Configuration is managed through `.env` files
- Use `make help` to see available commands
- The Makefile contains many common operations
- **Docker image builds are done by GitHub Actions** - do not build locally

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
| zeroclaw | Go | zeroclaw-labs/zeroclaw | `go build` |

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
