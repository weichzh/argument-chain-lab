export const AI_CONFIG_SCHEMA = 'argument-chain-ai-config';
export const AI_CONFIG_VERSION = 1;

const ALLOWED_KEYS = new Set([
  'schema',
  'version',
  'provider',
  'model',
  'apiKey',
  'baseUrl',
  'providerOptions',
]);

const isPlainObject = (value) => (
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

export const validateAiConfig = (value) => {
  if (!isPlainObject(value)) return { ok: false, error: '配置必须是 JSON 对象。' };
  const unknown = Object.keys(value).find((key) => !ALLOWED_KEYS.has(key));
  if (unknown) return { ok: false, error: `配置包含未知字段：${unknown}` };
  if (value.schema !== AI_CONFIG_SCHEMA || value.version !== AI_CONFIG_VERSION) {
    return { ok: false, error: '配置文本的 schema 或版本不受支持。' };
  }
  if (typeof value.provider !== 'string' || !value.provider.trim()) {
    return { ok: false, error: '请选择服务商。' };
  }
  if (typeof value.model !== 'string' || !value.model.trim()) {
    return { ok: false, error: '请选择模型。' };
  }
  if (typeof value.apiKey !== 'string' || !value.apiKey) {
    return { ok: false, error: 'API Key 不能为空。' };
  }
  if (value.baseUrl !== null && value.baseUrl !== undefined && typeof value.baseUrl !== 'string') {
    return { ok: false, error: 'Base URL 必须是字符串或 null。' };
  }
  if (!isPlainObject(value.providerOptions || {})) {
    return { ok: false, error: 'providerOptions 必须是 JSON 对象。' };
  }
  return {
    ok: true,
    value: {
      schema: AI_CONFIG_SCHEMA,
      version: AI_CONFIG_VERSION,
      provider: value.provider.trim(),
      model: value.model.trim(),
      apiKey: value.apiKey,
      baseUrl: value.baseUrl?.trim() || null,
      providerOptions: value.providerOptions || {},
    },
  };
};

export const parseAiConfig = (text) => {
  try {
    return validateAiConfig(JSON.parse(text));
  } catch {
    return { ok: false, error: '配置文本不是有效 JSON。' };
  }
};

export const serializeAiConfig = (config) => {
  const validated = validateAiConfig(config);
  if (!validated.ok) return validated;
  return { ok: true, value: `${JSON.stringify(validated.value, null, 2)}\n` };
};
