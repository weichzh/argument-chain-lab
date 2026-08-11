const MANIFEST_SCHEMA = 'argument-chain-bank-manifest';
const MANIFEST_VERSION = 1;

const resolveAssetUrl = (path) => {
  const base = import.meta.env?.BASE_URL || '/';
  const locationHref = globalThis.window?.location?.href || 'http://localhost/';
  return new URL(path.replace(/^\//, ''), new URL(base, locationHref)).toString();
};

const fetchJson = async (url, { optional = false } = {}) => {
  const response = await fetch(url, { cache: 'no-cache' });
  if (optional && response.status === 404) return null;
  if (!response.ok) throw new Error(`无法读取题库（HTTP ${response.status}）。`);
  return response.json();
};

export const validateBankManifest = (manifest) => {
  if (manifest?.schema !== MANIFEST_SCHEMA || manifest?.version !== MANIFEST_VERSION) {
    throw new Error('题库清单版本不受支持。');
  }
  if (!manifest.current || !Array.isArray(manifest.models)) {
    throw new Error('题库清单缺少当前版本。');
  }
  const selected = manifest.models.find((item) => item.version === manifest.current);
  if (!selected?.path) throw new Error('题库清单没有当前版本文件。');
  if (Boolean(selected.formalSchema) !== Boolean(selected.formalSchemes)) {
    throw new Error('题库清单的形式语言 schema 与方案目录必须同时提供。');
  }
  return selected;
};

const emptyExtension = () => ({
  facts: {},
  claims: {},
  arguments: {},
  policies: [],
  dilemmas: [],
});

export const communityBankToExtension = (communityBank) => {
  const extension = emptyExtension();
  if (communityBank?.schema !== 'argument-chain-community-bank' || !Array.isArray(communityBank.entries)) {
    return extension;
  }

  communityBank.entries.forEach((entry, entryIndex) => {
    const contribution = entry?.contribution?.argument;
    if (!contribution?.steps?.length || !entry.contentHash) return;
    const token = entry.contentHash.replace(/^sha256:/, '').slice(0, 16);
    const prefix = `community_${token}`;
    const direction = contribution.direction === 'oppose' ? 'oppose' : 'support';
    const rootClaimId = `${prefix}_claim_0`;
    const oppositeClaimId = `${prefix}_opposite`;
    const policyId = `${prefix}_policy`;

    extension.claims[rootClaimId] = {
      id: rootClaimId,
      kind: 'policy',
      policyId,
      direction,
      shortLabel: direction === 'support' ? '公开论证的支持判断' : '公开论证的反对判断',
      text: contribution.target.text,
      explanation: '这是一份经过明确贡献和人工审核后进入正式题库的结构化论证。',
    };
    extension.claims[oppositeClaimId] = {
      id: oppositeClaimId,
      kind: 'policy',
      policyId,
      direction: direction === 'support' ? 'oppose' : 'support',
      shortLabel: '相反方向',
      text: `不接受上述判断：${contribution.target.text}`,
      explanation: '公开贡献只覆盖一个论证方向；相反方向需要从其他题库理由或 AI 继续梳理。',
    };

    let firstArgumentId = null;
    contribution.steps.forEach((step, stepIndex) => {
      const targetClaimId = `${prefix}_claim_${stepIndex}`;
      const bridgeClaimId = `${prefix}_claim_${stepIndex + 1}`;
      const factIds = step.facts.map((fact, factIndex) => {
        const factId = `${prefix}_fact_${stepIndex}_${factIndex}`;
        extension.facts[factId] = {
          id: factId,
          kind: fact.kind,
          statement: fact.statement,
          plainExplanation: fact.plainExplanation,
          truthConditions: fact.truthConditions,
          plainTruthConditions: fact.plainTruthConditions,
          falsifier: fact.falsifier,
          plainFalsifier: fact.plainFalsifier,
          responseGuide: '请重新独立判断这项事实，不要因为它来自公开论证就直接接受。',
        };
        return factId;
      });

      extension.claims[bridgeClaimId] = {
        id: bridgeClaimId,
        kind: step.bridge.kind === 'terminal' ? 'terminal' : 'bridge',
        shortLabel: step.bridge.shortLabel,
        text: step.bridge.text,
        explanation: step.bridge.explanation,
        example: step.bridge.example,
        stressTest: step.bridge.kind === 'terminal' ? {
          scenario: entry.contribution.argument.stressTest.scenario,
          question: entry.contribution.argument.stressTest.question,
          distinctions: entry.contribution.argument.stressTest.distinction
            ? [entry.contribution.argument.stressTest.distinction]
            : [],
        } : undefined,
      };

      const argumentId = `${prefix}_argument_${stepIndex}`;
      if (!firstArgumentId) firstArgumentId = argumentId;
      extension.arguments[argumentId] = {
        id: argumentId,
        targetClaimId,
        title: step.bridge.shortLabel,
        summary: `核对 ${factIds.length} 项事实，再判断是否接受规范原则“${step.bridge.text}”。`,
        factIds,
        bridgeClaimId,
        plainSteps: {
          facts: factIds.map((factId) => extension.facts[factId].statement),
          bridge: step.bridge.text,
          result: step.target.text,
        },
        origin: 'community',
      };
    });

    extension.policies.push({
      id: policyId,
      number: `C${String(entryIndex + 1).padStart(2, '0')}`,
      title: contribution.target.text,
      shortTitle: contribution.target.text,
      proposition: contribution.target.text,
      scope: '这份公开论证只提供一个已经审核的方向；你仍需重新判断其中每项事实、原则与价值。',
      supportClaimId: direction === 'support' ? rootClaimId : oppositeClaimId,
      opposeClaimId: direction === 'oppose' ? rootClaimId : oppositeClaimId,
      question: '你要沿着这份公开论证的方向开始核对吗？',
      origin: 'community',
      availableDirections: [direction],
      directDirection: direction,
      directArgumentId: firstArgumentId,
    });
  });
  return extension;
};

const mergeExtension = (target, extension) => {
  if (!extension) return target;
  const normalized = extension.schema === 'argument-chain-community-bank'
    ? communityBankToExtension(extension)
    : extension;
  Object.assign(target.facts, normalized.facts || {});
  Object.assign(target.claims, normalized.claims || {});
  Object.assign(target.arguments, normalized.arguments || {});
  target.policies.push(...(normalized.policies || []));
  target.dilemmas.push(...(normalized.dilemmas || []));
  return target;
};

export const loadFormalBank = async () => {
  const manifestUrl = resolveAssetUrl('bank/manifest.json');
  const manifest = await fetchJson(manifestUrl);
  const selected = validateBankManifest(manifest);
  const modelUrl = new URL(selected.path, manifestUrl).toString();
  const extensionEntries = Array.isArray(manifest.extensions) ? manifest.extensions : [];

  const [model, benchmarks, arglogicCatalog, extensionFiles] = await Promise.all([
    fetchJson(modelUrl),
    selected.benchmarks
      ? fetchJson(new URL(selected.benchmarks, manifestUrl).toString())
      : Promise.resolve(null),
    selected.formalSchemes
      ? fetchJson(new URL(selected.formalSchemes, manifestUrl).toString())
      : Promise.resolve(null),
    Promise.all(extensionEntries.map(async (entry) => {
      const extensionUrl = new URL(entry.path, manifestUrl).toString();
      return fetchJson(extensionUrl, { optional: entry.required === false });
    })),
  ]);

  const extension = extensionFiles.reduce(mergeExtension, emptyExtension());
  const mergedModel = {
    ...model,
    arglogicCatalog,
    ideologyBenchmarks: benchmarks || { profiles: [] },
    facts: { ...model.facts, ...extension.facts },
    claims: { ...model.claims, ...extension.claims },
    arguments: { ...model.arguments, ...extension.arguments },
    policies: [...model.policies, ...extension.policies],
    dilemmas: [...model.dilemmas, ...extension.dilemmas],
  };
  return { manifest, model: mergedModel, extension, benchmarks };
};

export const bankManifestConstants = Object.freeze({
  schema: MANIFEST_SCHEMA,
  version: MANIFEST_VERSION,
});
