#!/usr/bin/env node
// =============================================================================
// ZeroClaw Configuration Builder
// =============================================================================
// Generates ZeroClaw config from environment variables
// Output: ~/.zeroclaw/config.toml (Rust TOML format)
// Based on: zeroclaw onboard --api-key <key> output
// =============================================================================

function buildConfig(STATE_DIR, WORKSPACE_DIR, parseList, PROVIDER_URLS, PROVIDER_MODELS) {
    const primaryModel = process.env.OPENCLAW_PRIMARY_MODEL || 'zai/glm-5';
    const parts = primaryModel.split('/');
    const provider = parts.length > 1 ? parts[0] : 'zai';
    const model = parts.length > 1 ? parts.slice(1).join('/') : primaryModel;

    const providerAliases = {
        'kimi-coding': 'kimi-code',
        'kimi_for_coding': 'kimi-code',
        'kimi': 'moonshot',
    };

    const providerKeys = {
        zai: process.env.ZAI_API_KEY,
        'kimi-code': process.env.KIMI_API_KEY,
        moonshot: process.env.KIMI_API_KEY,
        openrouter: process.env.OPENROUTER_API_KEY,
        anthropic: process.env.ANTHROPIC_API_KEY,
        openai: process.env.OPENAI_API_KEY,
        gemini: process.env.GEMINI_API_KEY,
        zhipu: process.env.ZAI_API_KEY,
        groq: process.env.GROQ_API_KEY,
        xai: process.env.XAI_API_KEY,
        mistral: process.env.MISTRAL_API_KEY,
        cerebras: process.env.CEREBRAS_API_KEY,
        opencode: process.env.OPENCODE_API_KEY,
        copilot: process.env.COPILOT_GITHUB_TOKEN,
        xiaomi: process.env.XIAOMI_API_KEY,
        venice: process.env.VENICE_API_KEY,
        minimax: process.env.MINIMAX_API_KEY,
    };

    let apiKey = '';
    let defaultProvider = providerAliases[provider] || provider;
    for (const [name, key] of Object.entries(providerKeys)) {
        if (key) {
            apiKey = key;
            const lookupProvider = providerAliases[provider] || provider;
            if (lookupProvider === name || !providerKeys[lookupProvider]) {
                defaultProvider = name;
            }
            break;
        }
    }

    const gatewayPort = parseInt(process.env.OPENCLAW_INTERNAL_GATEWAY_PORT || '18789', 10);
    const gatewayHost = process.env.ZEROCLAW_GATEWAY_HOST || '127.0.0.1';

    // Build complete zeroclaw config based on zeroclaw onboard output
    const config = {
        api_key: apiKey,
        default_provider: defaultProvider,
        default_model: model,
        default_temperature: 0.7,
        model_routes: [],
        embedding_routes: [],

        model_providers: {},

        observability: {
            backend: 'none',
            runtime_trace_mode: 'none',
            runtime_trace_path: 'state/runtime-trace.jsonl',
            runtime_trace_max_entries: 200,
        },

        autonomy: {
            level: 'full',
            workspace_only: true,
            allowed_commands: ['*'],
            forbidden_paths: ['/etc', '/root', '/home', '/usr', '/bin', '/sbin', '/lib', '/opt', '/boot', '/dev', '/proc', '/sys', '/var', '/tmp', '~/.ssh', '~/.gnupg', '~/.aws', '~/.config'],
            max_actions_per_hour: 20,
            max_cost_per_day_cents: 500,
            require_approval_for_medium_risk: false,
            block_high_risk_commands: false,
            shell_env_passthrough: ['PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'LC_ALL', 'TERM', 'DISPLAY', 'EDITOR', 'VISUAL', 'PWD', 'OLDPWD', 'HOSTNAME', 'TZ'],
            auto_approve: ['*'],
            always_ask: [],
            allowed_roots: [],
            non_cli_excluded_tools: [],
        },

        security: {
            sandbox: {
                backend: 'auto',
                firejail_args: [],
            },
            resources: {
                max_memory_mb: 512,
                max_cpu_time_seconds: 60,
                max_subprocesses: 10,
                memory_monitoring: true,
            },
            audit: {
                enabled: true,
                log_path: 'audit.log',
                max_size_mb: 100,
                sign_events: false,
            },
            otp: {
                enabled: false,
                method: 'totp',
                token_ttl_secs: 30,
                cache_valid_secs: 300,
                gated_actions: ['shell', 'file_write', 'browser_open', 'browser', 'memory_forget'],
                gated_domains: [],
                gated_domain_categories: [],
            },
            estop: {
                enabled: false,
                state_file: '~/.zeroclaw/estop-state.json',
                require_otp_to_resume: true,
            },
        },

        runtime: {
            kind: 'docker',
            docker: {
                image: 'alpine:3.20',
                network: 'none',
                memory_limit_mb: 512,
                cpu_limit: 1.0,
                read_only_rootfs: true,
                mount_workspace: true,
                allowed_workspace_roots: [],
            },
        },

        reliability: {
            provider_retries: 2,
            provider_backoff_ms: 500,
            fallback_providers: ['kimi-code', 'gemini'],
            api_keys: [],
            channel_initial_backoff_secs: 2,
            channel_max_backoff_secs: 60,
            scheduler_poll_secs: 15,
            scheduler_retries: 2,
            model_fallbacks: {
                'zai/glm-5': ['kimi-code/kimi-for-coding', 'gemini/gemini-3.1-pro-preview-customtools'],
            },
        },

        scheduler: {
            enabled: true,
            max_tasks: 64,
            max_concurrent: 4,
        },

        agent: {
            compact_context: true,
            max_tool_iterations: 1000,
            max_history_messages: 500,
            parallel_tools: true,
            tool_dispatcher: 'auto',
        },

        skills: {
            open_skills_enabled: true,
            prompt_injection_mode: 'full',
        },

        query_classification: {
            enabled: false,
            rules: [],
        },

        heartbeat: {
            enabled: true,
            interval_minutes: 30,
        },

        cron: {
            enabled: true,
            max_run_history: 50,
        },

        channels_config: {
            cli: true,
            message_timeout_secs: 300,
        },

        memory: {
            backend: 'sqlite',
            auto_save: true,
            hygiene_enabled: true,
            archive_after_days: 7,
            purge_after_days: 30,
            conversation_retention_days: 30,
            embedding_provider: 'none',
            embedding_model: 'text-embedding-3-small',
            embedding_dimensions: 1536,
            vector_weight: 0.7,
            keyword_weight: 0.3,
            min_relevance_score: 0.4,
            embedding_cache_size: 10000,
            chunk_max_tokens: 512,
            response_cache_enabled: false,
            response_cache_ttl_minutes: 60,
            response_cache_max_entries: 5000,
            snapshot_enabled: false,
            snapshot_on_hygiene: false,
            auto_hydrate: true,
            qdrant: {
                collection: 'zeroclaw_memories',
            },
        },

        storage: {
            provider: {
                config: {
                    provider: '',
                    schema: 'public',
                    table: 'memories',
                },
            },
        },

        tunnel: {
            provider: 'none',
        },

        gateway: {
            port: gatewayPort,
            host: gatewayHost,
            require_pairing: false,
            allow_public_bind: false,
            paired_tokens: [],
            pair_rate_limit_per_minute: 10,
            webhook_rate_limit_per_minute: 60,
            trust_forwarded_headers: true,
            rate_limit_max_keys: 10000,
            idempotency_ttl_secs: 300,
            idempotency_max_keys: 10000,
        },

        composio: {
            enabled: true,
            entity_id: 'default',
            api_key: process.env.COMPOSIO_API_KEY || '',
        },

        secrets: {
            encrypt: true,
        },

        browser: {
            enabled: true,
            allowed_domains: ['*'],
            backend: 'agent_browser',
            native_headless: true,
            native_webdriver_url: 'http://openclaw-browser:9222',
            computer_use: {
                endpoint: 'http://127.0.0.1:8787/v1/actions',
                timeout_ms: 15000,
                allow_remote_endpoint: false,
                window_allowlist: [],
            },
        },

        http_request: {
            enabled: true,
            allowed_domains: ['*'],
            max_response_size: 1000000,
            timeout_secs: 30,
        },

        multimodal: {
            max_images: 4,
            max_image_size_mb: 5,
            allow_remote_fetch: true,
        },

        web_fetch: {
            enabled: true,
            allowed_domains: ['*'],
            blocked_domains: [],
            max_response_size: 500000,
            timeout_secs: 30,
        },

        web_search: {
            enabled: true,
            provider: 'duckduckgo',
            max_results: 5,
            timeout_secs: 15,
        },

        proxy: {
            enabled: false,
            no_proxy: [],
            scope: 'zeroclaw',
            services: [],
        },

        identity: {
            format: 'openclaw',
        },

        cost: {
            enabled: false,
            daily_limit_usd: 10.0,
            monthly_limit_usd: 100.0,
            warn_at_percent: 80,
            allow_override: false,
            prices: {},
        },

        peripherals: {
            enabled: false,
            boards: [],
        },

        agents: {},

        hooks: {
            enabled: true,
            builtin: {
                command_logger: true,
            },
        },

        hardware: {
            enabled: false,
            transport: 'None',
            baud_rate: 115200,
            workspace_datasheets: false,
        },

        transcription: {
            enabled: false,
            api_url: 'https://api.groq.com/openai/v1/audio/transcriptions',
            model: 'whisper-large-v3-turbo',
            max_duration_secs: 120,
        },
    };

    // Add WhatsApp Web configuration if enabled
    if (process.env.WHATSAPP_ENABLED === 'true') {
        config.channels_config.whatsapp = {
            session_path: '~/.zeroclaw/state/whatsapp-web/session.db',
            pair_phone: process.env.ZEROCLAW_WHATSAPP_PAIR_PHONE || '',
            pair_code: process.env.ZEROCLAW_WHATSAPP_PAIR_CODE || '',
            allowed_numbers: ['*'],
        };
    }

    return config;
}

module.exports = { buildConfig };
