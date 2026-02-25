# Memory

## Mandatory Git Workflow

When making ANY code changes, ALWAYS follow this workflow:

1. **Use worktrees** - Create a git worktree for isolation: `git worktree add ../polyclaw-worktrees/branch-name -b branch-name`
2. **git fetch** - Get latest changes from remote
3. **git merge origin/main** - Merge main into your branch BEFORE pushing (resolve any conflicts)
4. **git add** - Stage the changes
5. **git commit** - Commit with descriptive message
6. **git push** - Push to remote
7. **create PR** - Create a pull request using `gh pr create`
8. **monitor PR** - Check CI status: `gh pr checks <pr-number>` and fix any failures immediately
9. **merge PR** - After approval, merge: `gh pr merge`
10. **verify post-merge** - Ensure post-merge actions succeed

This workflow is NON-NEGOTIABLE for all code changes.

**IMPORTANT**: 
- Always use worktrees for isolation
- Always merge origin/main into your branch before pushing to avoid merge conflicts on the PR
- If a PR has merge conflicts, fix them by merging main into the PR branch

## PR Lifecycle (CRITICAL - ALWAYS COMPLETE THIS CYCLE)

**After pushing a PR, you MUST complete the entire lifecycle:**

1. **Monitor PR** - Check status: `gh pr checks <pr-number>`
2. **Fix failures** - If failed, view logs: `gh run view <run-id> --log-failed`
3. **Repeat** - Keep monitoring and fixing until ALL checks pass
4. **Merge** - Once checks pass and approved, merge: `gh pr merge`
5. **Verify post-merge** - Check that post-merge actions (builds, deployments) succeed

**NEVER abandon a PR with failing checks.**

**Common fixes:**
- Pre-commit: Run `pre-commit run --all-files` locally before committing
- Tests: Run `uv run pytest tests/unit -v` locally
- YAML lint: Check indentation and syntax

## Important Rules

- **NEVER push directly to main** - Always create a branch and PR
- **Always create a PR** - Every code change must go through a pull request
- **Never merge PRs without approval** - Create PR and wait for review/approval before merging
- Do not use `--admin` flag to bypass branch protection rules

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

- **Architecture naming**:
  - `uname -m` returns `x86_64` but Go download URLs use `amd64`
  - For Docker linux/amd64 builds, use hardcoded `amd64` in download URL

## GitHub Actions Workflow Dependencies

- **Job dependency race condition**: Jobs with `needs:` dependency can sometimes start before the dependency job's outputs are fully available
  - In `.github/workflows/docker-build.yml`, build jobs depend on `check-pr-status` to get `can_skip_build` output
  - However, outputs aren't immediately available to dependent jobs - there's a small delay
  - If dependent jobs start too early, they can't access the output and fail with "State not set" or similar errors
  - **Solution**: Don't have build jobs depend on external output. Instead, check the PR status logic inside each build job itself

- **Workflow `needs` clause behavior**:
  - `needs: [job1, job2]` means the job waits for BOTH jobs to complete
  - The dependency job must finish completely (including output setting) before the dependent job starts
  - GitHub Actions has a delay of several seconds between job completion and output availability
  - **Pattern**: Have self-contained logic in each job that can independently decide whether to run, rather than relying on outputs from a separate job

- **Correct pattern for PR artifact reuse**:
  - Each build job should check if it came from a PR merge and has available artifacts
  - If yes, skip build and download artifacts from PR run
  - If no, build fresh images
  - This avoids the race condition where jobs try to access outputs before they're available

## Upstream Variants

This project builds Docker images for four upstream variants:

1. **OpenClaw** (`openclaw/openclaw`) - Node.js-based, official implementation
   - Built with `pnpm install && pnpm build`
   - Has UI components (`pnpm ui:build`)
   - Entry point: `node /opt/openclaw/app/openclaw.mjs`

2. **PicoClaw** (`sipeed/picoclaw`) - Go-based, lightweight implementation
   - Built with `go build`
   - No UI components
   - Entry point: `/opt/picoclaw/picoclaw`

3. **IronClaw** (`nearai/ironclaw`) - Rust-based, privacy-focused implementation
   - Built with `cargo build --release`
   - No UI components
   - Entry point: `/opt/ironclaw/ironclaw`

4. **ZeroClaw** (`zeroclaw-labs/zeroclaw`) - Rust-based implementation
   - Built with `cargo build --release --features whatsapp-web`
   - No UI components
   - Entry point: `/opt/zeroclaw/zeroclaw`

When adding a new upstream:
- Update `Dockerfile` clone logic with GitHub owner/repo
- Add build step for the new language/toolchain
- Update binary handling and CLI wrappers
- Add to CI matrix in `.github/workflows/docker-build.yml` and `manual-release.yml`
- Skip smoke tests if architecture differs (e.g., Rust binary has different API)

## Trivy/Code Scanning Matrix Changes

When changing the `security-scan` job matrix (e.g., adding a new upstream):
- GitHub Code Scanning shows warning: "X configurations not found"
- This happens because the old matrix categories no longer match the new ones
- **The warning is expected and will resolve after merge to main**
- Do NOT try to "fix" this warning - it's informational only
- All security scans still run and upload SARIF results correctly

Example: Adding `ironclaw` to matrix `[openclaw, picoclaw]` → `[openclaw, picoclaw, ironclaw]`
causes Code Scanning to not find a baseline for the new `ironclaw` category.
## Environment Variable Whitelist in Docker Entrypoint

When the entrypoint script runs as root and then switches to the upstream user via `su`, only whitelisted environment variables are passed through.

- **Problem**: If an env var is not in the `--whitelist-environment` list, it gets lost when switching users
- **Symptom**: Config shows correct values but the application doesn't see them because configure.js runs as the switched user
- **Location**: `scripts/entrypoint.sh` line ~93 in the `su` command
- **Fix**: Add any new environment variables that configure.js reads to the whitelist

Current whitelist (from `scripts/entrypoint.sh`):
```
HOME
UPSTREAM
OPENCLAW_STATE_DIR
OPENCLAW_WORKSPACE_DIR
OPENCLAW_EXTERNAL_GATEWAY_PORT
OPENCLAW_INTERNAL_GATEWAY_PORT
OPENCLAW_GATEWAY_TOKEN
AUTH_USERNAME
AUTH_PASSWORD
OPENCLAW_CONTROL_UI_ALLOWED_ORIGINS
OPENCLAW_CONTROL_UI_ALLOW_INSECURE_AUTH
OPENCLAW_GATEWAY_BIND
OPENCLAW_PRIMARY_MODEL
OPENCLAW_FALLBACK_MODELS
OPENCLAW_IMAGE_MODEL_PRIMARY
OPENCLAW_IMAGE_MODEL_FALLBACKS
BROWSER_CDP_URL
BROWSER_DEFAULT_PROFILE
BROWSER_EVALUATE_ENABLED
BROWSER_SNAPSHOT_MODE
BROWSER_REMOTE_TIMEOUT_MS
BROWSER_REMOTE_HANDSHAKE_TIMEOUT_MS
WHATSAPP_ENABLED
WHATSAPP_DM_POLICY
WHATSAPP_ALLOW_FROM
WHATSAPP_GROUP_POLICY
WHATSAPP_GROUP_ALLOW_FROM
WHATSAPP_SELF_CHAT_MODE
WHATSAPP_MEDIA_MAX_MB
WHATSAPP_HISTORY_LIMIT
TELEGRAM_BOT_TOKEN
TELEGRAM_DM_POLICY
TELEGRAM_ALLOW_FROM
TELEGRAM_GROUP_POLICY
TELEGRAM_GROUP_ALLOW_FROM
DISCORD_BOT_TOKEN
DISCORD_DM_POLICY
DISCORD_DM_ALLOW_FROM
DISCORD_GROUP_POLICY
SLACK_BOT_TOKEN
SLACK_APP_TOKEN
SLACK_DM_POLICY
SLACK_GROUP_POLICY
HOOKS_ENABLED
HOOKS_TOKEN
HOOKS_PATH
ANTHROPIC_API_KEY
ANTHROPIC_OAUTH_TOKEN
OPENAI_API_KEY
OPENROUTER_API_KEY
GEMINI_API_KEY
GOOGLE_API_KEY
XAI_API_KEY
GROQ_API_KEY
MISTRAL_API_KEY
CEREBRAS_API_KEY
MOONSHOT_API_KEY
KIMI_API_KEY
KIMI_CODE_API_KEY
ZAI_API_KEY
OPENCODE_API_KEY
COPILOT_GITHUB_TOKEN
XIAOMI_API_KEY
VENICE_API_KEY
MINIMAX_API_KEY
MINIMAX_OAUTH_TOKEN
MINIMAX_OAUTH_REFRESH_TOKEN
MINIMAX_OAUTH_CLIENT_ID
AI_GATEWAY_API_KEY
SYNTHETIC_API_KEY
ZEROCLAW_API_KEY
API_KEY
GLM_API_KEY
QIANFAN_API_KEY
ARK_API_KEY
DOUBAO_API_KEY
QWEN_OAUTH_TOKEN
DASHSCOPE_API_KEY
QWEN_OAUTH_REFRESH_TOKEN
DEEPSEEK_API_KEY
TOGETHER_API_KEY
FIREWORKS_API_KEY
NOVITA_API_KEY
PERPLEXITY_API_KEY
COHERE_API_KEY
LLAMACPP_API_KEY
SGLANG_API_KEY
VLLM_API_KEY
OSAURUS_API_KEY
NVIDIA_API_KEY
VERCEL_API_KEY
CLOUDFLARE_API_KEY
OLLAMA_BASE_URL
OLLAMA_API_KEY
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
AWS_SESSION_TOKEN
AWS_DEFAULT_REGION
BEDROCK_PROVIDER_FILTER
DEEPGRAM_API_KEY
OP_SERVICE_ACCOUNT_TOKEN
GOG_KEYRING_PASSWORD
ZEROCLAW_PROVIDER
ZEROCLAW_MODEL
ZEROCLAW_WORKSPACE
ZEROCLAW_TEMPERATURE
ZEROCLAW_GATEWAY_HOST
ZEROCLAW_WHATSAPP_APP_SECRET
ZEROCLAW_WHATSAPP_PAIR_PHONE
ZEROCLAW_WHATSAPP_PAIR_CODE
ZEROCLAW_WHATSAPP_ALLOWED_NUMBERS
```

When adding new env vars to `configure.js`, **always add them to the whitelist** in `entrypoint.sh`.

## Repository and Package Naming

- **Repository**: `xfanth/polyclaw` (formerly `xfanth/openclaw`)
- **Docker Images**: `ghcr.io/xfanth/{upstream}` where upstream is `openclaw`, `picoclaw`, `ironclaw`, or `zeroclaw`
- **Image tags**: `{upstream}_main` format (e.g., `openclaw_main`, `picoclaw_main`, `ironclaw_main`, `zeroclaw_main`)
- **Full image names**:
  - `ghcr.io/xfanth/zeroclaw:zeroclaw_main`
  - `ghcr.io/xfanth/openclaw:openclaw_main`
  - `ghcr.io/xfanth/ironclaw:ironclaw_main`
  - `ghcr.io/xfanth/picoclaw:picoclaw_main`
- **Note**: The `:latest` tag does NOT exist - always use `{upstream}_main` tags

When renaming a repository:
1. Update README.md badge URLs
2. Update workflow IMAGE_NAME references to use hardcoded `ghcr.io/xfanth/{upstream}`
3. Update local git remote: `git remote set-url origin git@github.com:xfanth/polyclaw.git`
4. **CodeQL Default Setup**: After renaming, disable and re-enable CodeQL in repository settings to clear cached database with old path
   - Go to Settings → Security → Code Security
   - Disable CodeQL, then re-enable it
   - Otherwise builds fail with "Invalid working directory: /home/runner/work/openclaw/openclaw"

## Hadolint Configuration

The Dockerfile uses a retry pattern for apt-get commands:
```dockerfile
RUN for i in 1 2 3; do \
        apt-get update && \
        apt-get install -y ... && \
        rm -rf /var/lib/apt/lists/* && \
        break || \
        (echo "Retry $i failed, waiting 10 seconds..." && sleep 10); \
    done
```

This triggers hadolint SC2015 warning (`A && B || C is not if-then-else`). The pattern is intentional for retry logic, so we ignore SC2015 in `.hadolint.yaml`.

## Available Tools

The following tools are available:
- `read` - Read files from filesystem
- `write` - Write files to filesystem
- `edit` - Edit existing files
- `bash` - Execute shell commands
- `glob` - Search for files by pattern
- `grep` - Search file contents
- `git_*` - Git operations (status, diff, commit, add, branch, etc.)
- `sequential-thinking` - Problem-solving through structured thinking
- `jina-mcp-server_*` - Web search, URL reading, image search, etc.
- `playwright_browser_*` - Browser automation
- `memory_*` - Knowledge graph operations
- `gemini-cli_*` - Gemini AI interactions
- `mcp-server-analyzer_*` - Code analysis (ruff, vulture)
- `filesystem_*` - File operations
- `mcp_everything_*` - Utility functions

## Project Structure

```
polyclaw/
├── .github/workflows/    # CI/CD workflows
├── config/               # Example configurations
├── scripts/              # Entry point and configuration scripts
├── .env.example          # Environment variable template
├── docker-compose.yml    # Docker Compose configuration
├── Dockerfile            # Multi-stage Docker build
├── Makefile              # Convenience commands
├── nginx.conf            # Nginx reverse proxy config
├── pyproject.toml        # Python project config (for tests)
└── tests/                # Test suite
```

## Common Commands

```bash
# Setup
cp .env.example .env && nano .env

# Start/stop
docker compose up -d
docker compose down

# Logs
docker compose logs -f gateway

# Shell
docker compose exec gateway bash

# Update
docker compose pull && docker compose up -d

# Makefile shortcuts
make help
make up
make logs
make shell
```

## Upstream Config File Formats

Each upstream uses a different config format and file location:

| Upstream | Format | Config Path | Notes |
|----------|--------|-------------|-------|
| OpenClaw | JSON | `$STATE_DIR/openclaw.json` | Full config with providers, channels, etc. |
| PicoClaw | JSON | `$STATE_DIR/.picoclaw/config.json` | Go-style snake_case keys |
| ZeroClaw | TOML | `$STATE_DIR/.zeroclaw/config.toml` | Flat structure with top-level fields |
| IronClaw | N/A | PostgreSQL database | Uses `ironclaw onboard` for setup |

### ZeroClaw Config Format (Critical!)

ZeroClaw uses a **flat TOML structure**, not nested like PicoClaw/OpenClaw:

```toml
# ZeroClaw config.toml - FLAT structure!
workspace_dir = "/data/.zeroclaw/workspace"
config_path = "/data/.zeroclaw/config.toml"
api_key = "your-api-key"
default_provider = "openrouter"
default_model = "anthropic/claude-sonnet-4-5"
default_temperature = 0.7

[gateway]
port = 18789
host = "127.0.0.1"
allow_public_bind = false
```

Reference: https://github.com/zeroclaw-labs/zeroclaw/blob/main/dev/config.template.toml

**Do NOT** use nested `[agents.defaults]` sections - ZeroClaw expects flat top-level fields.

### ZeroClaw Browser/CDP Configuration

ZeroClaw reads `BROWSER_CDP_URL` from Docker Compose environment and generates a `[browser]` section in config.toml:

```toml
[browser]
enabled = true
backend = "agent_browser"
native_webdriver_url = "http://browser:9222"
```

The browser sidecar in docker-compose.yml exposes:
- CDP on port 9222 (Chrome DevTools Protocol)
- noVNC on port 6080 (web-based VNC viewer)

To enable browser automation:
1. Set `BROWSER_CDP_URL=http://browser:9222` in `.env`
2. The browser sidecar container must be running
3. ZeroClaw's agent_browser backend will connect to CDP

**Note**: The `native_webdriver_url` field is repurposed for CDP endpoint in ZeroClaw's agent_browser backend.
