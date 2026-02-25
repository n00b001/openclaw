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
        'kimi-code': process.env.KIMI_CODE_API_KEY || process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY,
        'kimi': process.env.KIMI_API_KEY || process.env.KIMI_CODE_API_KEY || process.env.MOONSHOT_API_KEY,
        'moonshot': process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY,
        openrouter: process.env.OPENROUTER_API_KEY,
        anthropic: process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_OAUTH_TOKEN,
        openai: process.env.OPENAI_API_KEY,
        gemini: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
        'google': process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
        zhipu: process.env.GLM_API_KEY || process.env.ZAI_API_KEY,
        zai: process.env.ZAI_API_KEY || process.env.GLM_API_KEY,
        glm: process.env.GLM_API_KEY || process.env.ZAI_API_KEY,
        groq: process.env.GROQ_API_KEY,
        xai: process.env.XAI_API_KEY,
        mistral: process.env.MISTRAL_API_KEY,
        cerebras: process.env.CEREBRAS_API_KEY,
        opencode: process.env.OPENCODE_API_KEY,
        copilot: process.env.COPILOT_GITHUB_TOKEN,
        xiaomi: process.env.XIAOMI_API_KEY,
        venice: process.env.VENICE_API_KEY,
        minimax: process.env.MINIMAX_OAUTH_TOKEN || process.env.MINIMAX_API_KEY,
        synthetic: process.env.SYNTHETIC_API_KEY,
        qianfan: process.env.QIANFAN_API_KEY,
        doubao: process.env.DOUBAO_API_KEY || process.env.ARK_API_KEY,
        ark: process.env.ARK_API_KEY || process.env.DOUBAO_API_KEY,
        qwen: process.env.QWEN_OAUTH_TOKEN || process.env.DASHSCOPE_API_KEY,
        dashscope: process.env.DASHSCOPE_API_KEY || process.env.QWEN_OAUTH_TOKEN,
        deepseek: process.env.DEEPSEEK_API_KEY,
        together: process.env.TOGETHER_API_KEY,
        fireworks: process.env.FIREWORKS_API_KEY,
        novita: process.env.NOVITA_API_KEY,
        perplexity: process.env.PERPLEXITY_API_KEY,
        cohere: process.env.COHERE_API_KEY,
        nvidia: process.env.NVIDIA_API_KEY,
        vercel: process.env.VERCEL_API_KEY,
        cloudflare: process.env.CLOUDFLARE_API_KEY,
        llamacpp: process.env.LLAMACPP_API_KEY,
        sglang: process.env.SGLANG_API_KEY,
        vllm: process.env.VLLM_API_KEY,
        osaurus: process.env.OSAURUS_API_KEY,
    };

    let apiKey = process.env.API_KEY || process.env.ZEROCLAW_API_KEY || '';
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

    const browserCdpUrl = process.env.BROWSER_CDP_URL;
    if (browserCdpUrl) {
        config.browser = {
            enabled: true,
            backend: 'agent_browser',
            native_webdriver_url: browserCdpUrl
        };
    }

    return config;
}

module.exports = { buildConfig };
