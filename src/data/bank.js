const MANIFEST_SCHEMA = 'argument-chain-bank-manifest';
const MANIFEST_VERSION = 2;

const resolveAssetUrl = (path) => {
  const base = import.meta.env?.BASE_URL || '/';
  const locationHref = globalThis.window?.location?.href || 'http://localhost/';
  return new URL(path.replace(/^\//, ''), new URL(base, locationHref)).toString();
};

const fetchJson = async (url) => {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`无法读取题库（HTTP ${response.status}）。`);
  return response.json();
};

export const validateBankManifest = (manifest) => {
  if (manifest?.schema !== MANIFEST_SCHEMA || manifest?.version !== MANIFEST_VERSION) {
    throw new Error('题库清单版本不受支持。');
  }
  const selected = manifest.models?.find((item) => (
    item.version === manifest.default && item.status === 'current'
  ));
  if (!selected?.path || selected.schemaVersion !== 4) {
    throw new Error('题库清单没有可用的 v4 当前版本。');
  }
  if (manifest.models.some((item) => item.version !== manifest.default && item.status === 'current')) {
    throw new Error('题库清单只能声明一个当前版本。');
  }
  return selected;
};

export const loadFormalBank = async () => {
  const manifestUrl = resolveAssetUrl('bank/manifest.json');
  const manifest = await fetchJson(manifestUrl);
  const selected = validateBankManifest(manifest);
  const model = await fetchJson(new URL(selected.path, manifestUrl).toString());
  return { manifest, model, selected };
};

export const bankManifestConstants = Object.freeze({
  schema: MANIFEST_SCHEMA,
  version: MANIFEST_VERSION,
});
