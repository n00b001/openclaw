#!/usr/bin/env node
// =============================================================================
// ZeroClaw Configuration Builder
// =============================================================================
// Generates ZeroClaw config from environment variables
// Output: ~/.zeroclaw/config.toml (Rust TOML format)
// See: https://github.com/zeroclaw-labs/zeroclaw/blob/main/dev/config.template.toml
// =============================================================================

function buildConfig(STATE_DIR, WORKSPACE_DIR, parseList, PROVIDER_URLS, PROVIDER_MODELS) {
    const primaryModel = process.env.OPENCLAW_PRIMARY_MODEL || 'zhipu/glm-4.7';
    const parts = primaryModel.split('/');
    const provider = parts.length > 1 ? parts[0] : 'zhipu';
    const model = parts.length > 1 ? parts.slice(1).join('/') : primaryModel;

    const providerAliases = {
        'kimi-coding': 'kimi-code',
        'kimi_for_coding': 'kimi-code',
        'kimi': 'moonshot',
    };

    const providerKeys = {
        'kimi-code': process.env.KIMI_API_KEY,
        moonshot: process.env.KIMI_API_KEY,
        openrouter: process.env.OPENROUTER_API_KEY,
        anthropic: process.env.ANTHROPIC_API_KEY,
        openai: process.env.OPENAI_API_KEY,
        gemini: process.env.GEMINI_API_KEY,
        zhipu: process.env.ZAI_API_KEY,
        zai: process.env.ZAI_API_KEY,
        groq: process.env.GROQ_API_KEY,
        xai: process.env.XAI_API_KEY,
        mistral: process.env.MISTRAL_API_KEY,
        cerebras: process.env.CEREBRAS_API_KEY,
        moonshot: process.env.MOONSHOT_API_KEY,
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

    // Build complete zeroclaw config based on official template
    const config = {
        // Core settings
        api_key: apiKey,
        default_provider: defaultProvider,
        default_model: model,
        default_temperature: 0.7,

        // Memory configuration
        memory: {
            backend: 'sqlite',
            auto_save: true,
            embedding_provider: 'none',
            vector_weight: 0.7,
            keyword_weight: 0.3,
        },

        // Gateway configuration
        gateway: {
            port: gatewayPort,
            host: gatewayHost,
            require_pairing: true,
            allow_public_bind: false,
        },

        // Autonomy settings
        autonomy: {
            level: 'supervised',
            workspace_only: true,
            allowed_commands: ['git', 'npm', 'cargo', 'ls', 'cat', 'grep'],
            forbidden_paths: ['/etc', '/root', '/proc', '/sys', '~/.ssh', '~/.gnupg', '~/.aws'],
            allowed_roots: [],
        },

        // Runtime configuration
        runtime: {
            kind: 'native',
        },

        // Tunnel configuration
        tunnel: {
            provider: 'none',
        },

        // Secrets encryption
        secrets: {
            encrypt: true,
        },

        // Browser configuration (disabled by default)
        browser: {
            enabled: false,
            allowed_domains: ['docs.rs'],
            backend: 'agent_browser',
            native_headless: true,
            native_webdriver_url: 'http://127.0.0.1:9515',
        },

        // Heartbeat configuration (disabled by default)
        heartbeat: {
            enabled: false,
            interval_minutes: 30,
            message: 'Check London time',
            target: 'telegram',
            to: '',
        },

        // Composio integration (disabled by default)
        composio: {
            enabled: false,
            entity_id: 'default',
        },

        // Identity format
        identity: {
            format: 'openclaw',
        },
    };

    // Always add channels_config with cli field to prevent zeroclaw from creating
    // an incomplete config that causes "missing field `cli`" error
    config.channels_config = {
        cli: {
            enabled: true,
            prompt: 'zeroclaw>',
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
