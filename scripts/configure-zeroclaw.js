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

    const providerKeys = {
        'kimi-coding': process.env.KIMI_API_KEY,
        'kimi': process.env.KIMI_API_KEY,
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
    let defaultProvider = provider;
    for (const [name, key] of Object.entries(providerKeys)) {
        if (key) {
            apiKey = key;
            if (provider === name || !providerKeys[provider]) {
                defaultProvider = name;
            }
            break;
        }
    }

    const gatewayPort = parseInt(process.env.OPENCLAW_INTERNAL_GATEWAY_PORT || '18789', 10);
    const gatewayHost = process.env.ZEROCLAW_GATEWAY_HOST || '127.0.0.1';

    const config = {
        workspace_dir: WORKSPACE_DIR,
        config_path: `${STATE_DIR}/config.toml`,
        api_key: apiKey,
        default_provider: defaultProvider,
        default_model: model,
        default_temperature: 0.7,
        gateway: {
            port: gatewayPort,
            host: gatewayHost,
            allow_public_bind: false
        },
        channels_config: {
            whatsapp: {
                session_path: '~/.zeroclaw/state/whatsapp-web/session.db',
                pair_phone: process.env.ZEROCLAW_WHATSAPP_PAIR_PHONE || '',
                pair_code: process.env.ZEROCLAW_WHATSAPP_PAIR_CODE || '',
                allowed_numbers: process.env.ZEROCLAW_WHATSAPP_ALLOWED_NUMBERS
                    ? process.env.ZEROCLAW_WHATSAPP_ALLOWED_NUMBERS.split(',').map(s => s.trim())
                    : ['*']
            }
        }
    };

    return config;
}

module.exports = { buildConfig };
