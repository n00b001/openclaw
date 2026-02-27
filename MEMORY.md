# Memory

## Mandatory Git Workflow

When making ANY code changes, ALWAYS follow this workflow:

1. **git pull** - Get latest changes from remote
2. **git branch** - Create a feature branch for the work
3. **git add** - Stage the changes
4. **git commit** - Commit with descriptive message
5. **git push** - Push to remote
6. **create PR** - Create a pull request using `gh pr create`
7. **monitor PR** - Check CI status and fix any failures immediately

This workflow is NON-NEGOTIABLE for all code changes.

**IMPORTANT**: You must always pull origin/main into your branch whenever making a change. You must resolve conflicts if they exist.

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
- **Create commit tracking file `.<upstream>-main-commit`** (see below)
- Skip smoke tests if architecture differs (e.g., Rust binary has different API)

## Upstream Commit Tracking (CRITICAL)

**NEVER build from latest main branch.** All builds must use pinned commit hashes for reproducibility.

### Commit Tracking Files

Each upstream has two tracking files:
- `.<upstream>-main-commit` - Pinned commit for main builds
- `.<upstream>-tagged-commit` - Optional, for tagged releases

Example files:
```
.openclaw-main-commit      # Contains commit hash for openclaw
.openclaw-tagged-commit    # Contains commit hash for latest release
.zeroclaw-main-commit      # Contains commit hash for zeroclaw
.zeroclaw-tagged-commit    # Contains commit hash for latest release
.picoclaw-main-commit      # Contains commit hash for picoclaw
.ironclaw-main-commit      # Contains commit hash for ironclaw
```

### How It Works

1. **Workflow reads commit from tracking file** - The `determine-version` step reads `.<upstream>-main-commit`
2. **Passes commit to Dockerfile** - Build arg `UPSTREAM_COMMIT` is set
3. **Dockerfile checks out at commit** - Uses `git fetch && git checkout` to pin the exact commit
4. **Build fails if file missing** - No fallback to "latest main"

### Updating Upstream Version

To update an upstream to a new version:

1. **Find the commit hash** for the desired version:
   ```bash
   # For a specific tag
   curl -s "https://api.github.com/repos/zeroclaw-labs/zeroclaw/git/ref/tags/v0.1.7" | jq -r '.object.sha'

   # For latest main (careful!)
   curl -s "https://api.github.com/repos/zeroclaw-labs/zeroclaw/commits/main" | jq -r '.sha'
   ```

2. **Update the tracking file**:
   ```bash
   echo "b17a636b39267038ff8475152472ef669ae828ab" > .zeroclaw-main-commit
   ```

3. **Test locally**:
   ```bash
   docker build --build-arg UPSTREAM_COMMIT=$(cat .zeroclaw-main-commit) -f Dockerfile-zeroclaw -t zeroclaw:test .
   ```

4. **Create PR** with the updated tracking file

### Daily Update Process

A daily process should:
1. Check upstream repos for new releases
2. Update the `.<upstream>-tagged-commit` file
3. Create a PR for the update
4. CI validates the build before merge

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

Current whitelist (from `scripts/entrypoint.sh` line 93):
```
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
BROWSER_CDP_URL
BROWSER_DEFAULT_PROFILE
WHATSAPP_ENABLED
WHATSAPP_DM_POLICY
WHATSAPP_ALLOW_FROM
TELEGRAM_BOT_TOKEN
TELEGRAM_DM_POLICY
DISCORD_BOT_TOKEN
DISCORD_DM_POLICY
SLACK_BOT_TOKEN
SLACK_DM_POLICY
HOOKS_ENABLED
HOOKS_TOKEN
HOOKS_PATH
ANTHROPIC_API_KEY
OPENAI_API_KEY
OPENROUTER_API_KEY
GEMINI_API_KEY
XAI_API_KEY
GROQ_API_KEY
MISTRAL_API_KEY
CEREBRAS_API_KEY
MOONSHOT_API_KEY
KIMI_API_KEY
ZAI_API_KEY
OPENCODE_API_KEY
COPILOT_GITHUB_TOKEN
XIAOMI_API_KEY
COMPOSIO_API_KEY
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

## Screen and Supervisord Support

The zeroclaw Dockerfile includes:
- `screen` - Terminal multiplexer for interactive sessions
- `supervisord` - For service management (NOT systemd)

These can be used for:
- Interactive sessions: `screen -S mysession`
- Service management: `supervisorctl status`

**Note**: systemctl will NOT work in the container because systemd is not running as PID 1. Docker containers use supervisord for process management.

## Zeroclaw Channel Start

To start communication channels (WhatsApp, Telegram, etc.):
```bash
zeroclaw channel start
```

This command starts all enabled communication channels defined in the config.

## ZeroClaw Default Configuration

ZeroClaw uses permissive defaults for full autonomy mode. Key settings in `scripts/configure-zeroclaw.js`:

### Provider Settings
- `default_provider: 'zai'` - Z.AI as default provider (fixed, never changes)
- `default_model: 'glm-5'` - GLM-5 as default model (fixed, never changes)
- `api_key` - Uses first available key from: ZAI_API_KEY, KIMI_API_KEY, etc.
- Fallback models handle requests when ZAI_API_KEY is unavailable

### Autonomy Settings
- `level: 'full'` - Full autonomy mode (not supervised)
- `allowed_commands: ['*']` - All commands allowed (no restrictions)
- `auto_approve: ['*']` - Auto-approve all tool calls
- `require_approval_for_medium_risk: false` - No approval for medium-risk actions
- `block_high_risk_commands: false` - Allow high-risk commands
- `shell_env_passthrough: ['PATH', 'HOME', ...]` - Common env vars passed to shell

**Note**: `shell_env_passthrough` cannot use `*` wildcard - it must be specific env var names matching `[A-Za-z_][A-Za-z0-9_]*` pattern.

### Runtime Settings
- `runtime.kind: 'docker'` - Containerized execution (not native)

### Enabled Tools
- `browser.enabled: true` - Browser automation enabled
- `browser.allowed_domains: ['*']` - All domains allowed
- `browser.native_webdriver_url: 'http://openclaw-browser:9222'` - CDP endpoint
- `http_request.enabled: true` - HTTP requests enabled
- `web_fetch.enabled: true` - Web fetching enabled
- `web_search.enabled: true` - Web search enabled
- `composio.enabled: true` - Composio integration enabled (requires `COMPOSIO_API_KEY`)
- `skills.open_skills_enabled: true` - Open skills enabled

### Hooks
- `hooks.builtin.command_logger: true` - Command logging enabled for auditing

### Performance Settings
- `agent.compact_context: true` - Compact context for better token usage
- `agent.parallel_tools: true` - Execute tools in parallel
- `heartbeat.enabled: true` - Enable heartbeat monitoring

### Gateway Settings
- `gateway.require_pairing: false` - No pairing required
- `gateway.trust_forwarded_headers: true` - Trust X-Forwarded-* headers

### ZeroClaw Runtime Mode

ZeroClaw runs via `zeroclaw daemon` (not `zeroclaw gateway`) in Docker:

| Command | Purpose |
|---------|---------|
| `zeroclaw gateway` | HTTP webhook server only (no channels) |
| `zeroclaw daemon` | **Full runtime** - gateway + channels + scheduler + heartbeat |

**Important**: The daemon does NOT read `gateway.port` from config - you must pass `-p <port>` explicitly:
```bash
zeroclaw daemon -p 18789
```

This is why channels weren't starting automatically with `zeroclaw gateway` - channels require the daemon runtime.

## Supervisord Logging for Docker

The container uses supervisord to manage nginx and the upstream gateway. For `docker logs` to capture output:

**ZeroClaw (special handling):**
- Runs supervisord as root (not switched via `su`)
- Uses `user=zeroclaw` in program sections for privilege dropping
- This allows `/dev/stdout` to be opened successfully for log redirection

**Configuration in `scripts/entrypoint.sh`:**
```ini
[supervisord]
nodaemon=true
logfile=/dev/null
pidfile=/tmp/supervisord.pid

[program:nginx]
command=nginx -g "daemon off;"
user=zeroclaw
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:zeroclaw]
command=/usr/local/bin/zeroclaw daemon -p 18789
user=zeroclaw
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

**Key points:**
- `/dev/stdout` redirects stdout to supervisord's stdout (which Docker captures)
- `/dev/stderr` redirects stderr to supervisord's stderr (which Docker captures)
- `*_logfile_maxbytes=0` disables log rotation (not needed for Docker)
- `user=zeroclaw` in program configs drops privileges for each service
- Supervisord runs as root and can open `/dev/stdout` before dropping privileges

**Why ZeroClaw runs supervisord as root:**
- When using `su` to switch users, `/dev/stdout` becomes inaccessible (EACCES)
- By running supervisord as root, it can open `/dev/stdout` successfully
- The `user=` directive then drops privileges for child processes
- Other upstreams (openclaw, picoclaw, ironclaw) use the traditional `su` approach

## TOML Key Quoting

When generating TOML config files, keys containing special characters (like `/`) must be quoted.

**Problem:** Keys like `zai/glm-5` fail with:
```
TOML parse error at line 83, column 16
   |
83 | zai/glm-5 = ["kimi-code/kimi-for-coding", "gemini/gemini-3.1-pro-preview-customtools"]
   |            ^
   invalid unquoted key, expected letters, numbers, `-`, `_`
```

**Solution:** The `toTomlKey()` function in `scripts/configure.js` quotes keys that don't match the TOML unquoted key pattern `^[A-Za-z_][A-Za-z0-9_-]*$`:
```javascript
function toTomlKey(key) {
    if (/^[A-Za-z_][A-Za-z0-9_-]*$/.test(key)) {
        return key;
    }
    const escaped = key.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
}
```

**Valid TOML key output:**
```toml
"zai/glm-5" = ["kimi-code/kimi-for-coding", "gemini/gemini-3.1-pro-preview-customtools"]
```

## ZeroClaw Default Model and Fallback Providers

ZeroClaw is configured with the following model defaults (in `scripts/configure-zeroclaw.js`):

**Primary model:**
- `zai/glm-5` (Z.AI GLM-5)

**Fallback providers:**
- `kimi-code` - Kimi Code provider
- `gemini` - Google Gemini via AI Studio

**Model fallback chain:**
```toml
[model_fallbacks]
"zai/glm-5" = ["kimi-code/kimi-for-coding", "gemini/gemini-3.1-pro-preview-customtools"]
```

**Agent settings:**
- `max_tool_iterations: 1000` - High iteration limit for complex tasks
- `max_history_messages: 500` - Large message history for context

## ZeroClaw UI Pairing Check Bug

**Problem:** Even with `require_pairing: false` in config, the ZeroClaw UI still shows the pairing screen.

**Root Cause 1:** The nginx config didn't disable HTTP Basic Auth for the `/health` endpoint. The UI calls `/health` to check if pairing is required:
```javascript
// web/src/hooks/useAuth.tsx
getPublicHealth()
  .then((health) => {
    if (!health.require_pairing) {
      setAuthenticated(true);  // Should skip pairing screen
    }
  })
```

If `/health` returns 401 (due to HTTP Basic Auth), the UI falls through to showing the pairing screen.

**Fix 1:** Added `auth_basic off;` to the following nginx locations in `scripts/entrypoint.sh`:
- `/healthz` - Health check endpoint
- `/health` - ZeroClaw health endpoint (returns `require_pairing` status)
- `/pair` - Pairing endpoint (used by UI to submit pairing codes)
- `/hooks` - Webhook endpoint (token-based auth)

**Root Cause 2:** ZeroClaw UI checks the `paired` field instead of `require_pairing`. When `require_pairing: false`, the backend returns `paired: false`, and the UI shows the pairing screen.

**Fix 2:** Added nginx `sub_filter` to modify the `/health` response for ZeroClaw only:
```nginx
location /health {
    ...
    proxy_buffering on;
    sub_filter_types application/json;
    sub_filter '"paired":false,"require_pairing":false' '"paired":true,"require_pairing":false';
    sub_filter_once off;
}
```

This rewrites the response to set `paired: true` when `require_pairing: false`, making the UI skip the pairing screen.

**Related endpoints that must NOT have auth_basic:**
- `/health` - UI checks `require_pairing` status here
- `/pair` - UI submits pairing codes here
- `/healthz` - Docker health check
- `/hooks` - External webhooks (uses token auth, not HTTP Basic)
