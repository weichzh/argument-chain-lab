#!/usr/bin/env node
import fs from 'node:fs';
import { validateModel } from '../src/lib/decisionEngine.js';

const read = (name) => JSON.parse(fs.readFileSync(new URL(name, import.meta.url), 'utf8'));
const model = read('../public/bank/model-1.2.2.json');
const benchmark = read('../public/bank/ideology-benchmark-1.2.2.json');

const EXPECTED_LABELS = [
  'Anarcho-Communism', 'Libertarian Communism', 'Trotskyism', 'Marxism',
  'De Leonism', 'Leninism', 'Stalinism/Maoism', 'Religious Communism',
  'State Socialism', 'Theocratic Socialism', 'Religious Socialism',
  'Democratic Socialism', 'Revolutionary Socialism', 'Libertarian Socialism',
  'Anarcho-Syndicalism', 'Left-Wing Populism', 'Theocratic Distributism',
  'Distributism', 'Social Liberalism', 'Christian Democracy', 'Social Democracy',
  'Progressivism', 'Anarcho-Mutualism', 'National Totalitarianism',
  'Global Totalitarianism', 'Technocracy', 'Centrist', 'Liberalism',
  'Religious Anarchism', 'Right-Wing Populism', 'Moderate Conservatism',
  'Reactionary', 'Social Libertarianism', 'Libertarianism', 'Anarcho-Egoism',
  'Nazism', 'Autocracy', 'Fascism', 'Capitalist Fascism', 'Conservatism',
  'Neo-Liberalism', 'Classical Liberalism', 'Authoritarian Capitalism',
  'State Capitalism', 'Neo-Conservatism', 'Fundamentalism',
  'Libertarian Capitalism', 'Market Anarchism', 'Objectivism',
  'Totalitarian Capitalism', 'Ultra-Capitalism', 'Anarcho-Capitalism',
  'Eco-Marxism', 'Centrist-Marxism', 'Council-Communism', 'Left-Communism',
  'Eco-Anarchism', 'Utopian-Socialism', 'Left-Wing-Nationalism',
  'Absolute Monarchism', 'Constitutional Monarchism', 'Theocracy',
  'Individualist Anarchism', 'Agorism', 'Minarchism', 'Paleolibertarianism',
  'Geolibertarianism', 'Centre-Right Politics', 'Reactionary Conservatism',
  'Paleoconservatism', 'Paternalistic Conservatism', 'Fiscal Conservatism',
  'Pink Capitalism', 'Civic Nationalism', 'Progressive Conservatism',
];

const errors = [];
const warnings = [];
const add = (list, code, message, details = {}) => list.push({ code, message, ...details });

const modelCheck = validateModel(model);
if (!modelCheck.ok) {
  modelCheck.errors.forEach((item) => add(errors, `MODEL_${item.code || 'ERROR'}`, item.message || String(item), { detail: item }));
}
modelCheck.warnings?.forEach((item) => add(warnings, `MODEL_${item.code || 'WARNING'}`, item.message || String(item), { detail: item }));

if (benchmark.targetModelVersion !== model.meta.version) {
  add(errors, 'TARGET_MODEL_VERSION', 'Benchmark targetModelVersion 与模型版本不一致.', {
    benchmark: benchmark.targetModelVersion,
    model: model.meta.version,
  });
}

const labels = benchmark.profiles.map((profile) => profile.label);
if (labels.length !== EXPECTED_LABELS.length) {
  add(errors, 'PROFILE_COUNT', `应有 ${EXPECTED_LABELS.length} 个原型，实际为 ${labels.length}.`);
}
const missingLabels = EXPECTED_LABELS.filter((label) => !labels.includes(label));
const extraLabels = labels.filter((label) => !EXPECTED_LABELS.includes(label));
if (missingLabels.length || extraLabels.length) {
  add(errors, 'IDEOLOGY_LIST_MISMATCH', 'Benchmark 与 ideologies.js 的名称列表不一致.', { missingLabels, extraLabels });
}
if (new Set(labels).size !== labels.length) add(errors, 'DUPLICATE_LABEL', '原型名称存在重复。');
const labelsZh = benchmark.profiles.map((profile) => profile.labelZh);
if (labelsZh.some((label) => typeof label !== 'string' || !/[\u3400-\u9fff]/u.test(label))) {
  add(errors, 'MISSING_CHINESE_LABEL', '每个参考名称都必须提供中文名称。');
}
if (new Set(labelsZh).size !== labelsZh.length) add(errors, 'DUPLICATE_CHINESE_LABEL', '中文参考名称存在重复。');
const ids = benchmark.profiles.map((profile) => profile.id);
if (new Set(ids).size !== ids.length) add(errors, 'DUPLICATE_ID', '原型 ID 存在重复。');

const policyById = Object.fromEntries(model.policies.map((policy) => [policy.id, policy]));
const allPolicyIds = [...benchmark.corePolicyIds, ...benchmark.tieBreakerPolicyIds];
if (new Set(allPolicyIds).size !== allPolicyIds.length) add(errors, 'DUPLICATE_POLICY_SET', '核心题和精度题有重复。');
for (const policyId of allPolicyIds) {
  if (!policyById[policyId]) add(errors, 'UNKNOWN_POLICY', `Benchmark 引用了不存在的政策 ${policyId}.`);
}

const allowedSourceStatuses = new Set([
  'source_anchored',
  'tradition_reconstruction',
  'synthetic_stress_fixture',
  'site_label_provisional',
]);
const allowedRootAnswers = new Set(['yes', 'no', 'uncertain']);
const allowedRevisionAnswers = new Set(['accept', 'reject', 'uncertain']);
const allowedStress = new Set(['apply', 'qualified', 'retract', 'uncertain']);
const allowedImpacts = new Set(['no_change', 'weaken', 'offset', 'reverse', 'uncertain']);

const validateReasonPath = ({ profile, policyId, startClaimId, reasonIds, terminalValueId, kind }) => {
  if (!startClaimId) {
    if (reasonIds.length || terminalValueId) {
      add(errors, 'PATH_WITHOUT_START', `${profile.label}/${policyId}/${kind} 缺少起点，却存在路径。`);
    }
    return;
  }
  let target = startClaimId;
  const seenClaims = new Set([target]);
  reasonIds.forEach((reasonId, index) => {
    const reason = model.reasons[reasonId];
    if (!reason) {
      add(errors, 'UNKNOWN_REASON', `${profile.label}/${policyId}/${kind} 引用了不存在的理由 ${reasonId}.`);
      return;
    }
    if (reason.targetClaimId !== target) {
      add(errors, 'REASON_TARGET_MISMATCH', `${profile.label}/${policyId}/${kind} 第 ${index + 1} 条理由目标不匹配。`, {
        reasonId,
        expectedTarget: target,
        actualTarget: reason.targetClaimId,
      });
    }
    target = reason.bridgeClaimId;
    if (!model.claims[target]) {
      add(errors, 'UNKNOWN_BRIDGE', `${reasonId} 指向不存在的 bridge ${target}.`);
    }
    if (seenClaims.has(target) && index < reasonIds.length - 1) {
      add(errors, 'PATH_CYCLE', `${profile.label}/${policyId}/${kind} 路径形成循环。`, { claimId: target });
    }
    seenClaims.add(target);
  });
  if (reasonIds.length && target !== terminalValueId) {
    add(errors, 'TERMINAL_MISMATCH', `${profile.label}/${policyId}/${kind} 的终点与最后 bridge 不一致。`, {
      expected: target,
      actual: terminalValueId,
    });
  }
  if (terminalValueId && !model.claims[terminalValueId]) {
    add(errors, 'UNKNOWN_TERMINAL', `${profile.label}/${policyId}/${kind} 引用了不存在的终点 ${terminalValueId}.`);
  }
};

for (const profile of benchmark.profiles) {
  if (!allowedSourceStatuses.has(profile.source?.status)) {
    add(errors, 'SOURCE_STATUS', `${profile.label} 的 source status 无效。`, { status: profile.source?.status });
  }
  if (!profile.source?.anchor || !profile.source?.caveat) {
    add(errors, 'SOURCE_METADATA', `${profile.label} 缺少代表锚点或限制说明。`);
  }
  if (/夹具/.test(`${profile.source?.displayBasis || ''}${profile.source?.userNote || ''}`)) {
    add(errors, 'SOURCE_JARGON', `${profile.label} 的用户可见来源说明包含内部测试术语。`);
  }
  if (profile.referenceStatus === 'provisional_reference_variant') {
    if (profile.allowUniqueResult !== false || !profile.referenceFamilyId || !profile.inheritedPathFrom) {
      add(errors, 'PROVISIONAL_REFERENCE', `${profile.label} 的暂定参考限制不完整。`);
    }
  }
  const profilePolicyIds = Object.keys(profile.expectedPaths || {});
  const missingPolicies = allPolicyIds.filter((policyId) => !profilePolicyIds.includes(policyId));
  const extraPolicies = profilePolicyIds.filter((policyId) => !allPolicyIds.includes(policyId));
  if (missingPolicies.length || extraPolicies.length) {
    add(errors, 'PROFILE_POLICY_SET', `${profile.label} 的政策路径集合不完整。`, { missingPolicies, extraPolicies });
  }

  for (const policyId of allPolicyIds) {
    const path = profile.expectedPaths?.[policyId];
    const policy = policyById[policyId];
    if (!path || !policy) continue;
    if (!allowedRootAnswers.has(path.rootAnswer)) {
      add(errors, 'ROOT_ANSWER', `${profile.label}/${policyId} 根答案无效。`, { answer: path.rootAnswer });
    }
    if (path.policyId !== policyId) {
      add(errors, 'PATH_POLICY_ID', `${profile.label}/${policyId} path.policyId 不一致。`);
    }
    for (const answer of path.revisionAnswers || []) {
      if (!policy.diagnostics.some((diagnostic) => diagnostic.id === answer.diagnosticId)) {
        add(errors, 'UNKNOWN_DIAGNOSTIC', `${profile.label}/${policyId} 引用不存在的诊断 ${answer.diagnosticId}.`);
      }
      if (!allowedRevisionAnswers.has(answer.answer)) {
        add(errors, 'REVISION_ANSWER', `${profile.label}/${policyId}/${answer.diagnosticId} 的修订答案无效。`);
      }
    }

    if (path.rootAnswer === 'uncertain') {
      if (path.canonicalReasonPath?.length || path.terminalValueId || path.acceptedRevisionFrameId || path.diagnosisClaimId) {
        add(errors, 'UNCERTAIN_HAS_COMMITMENT', `${profile.label}/${policyId} 的 uncertain 路径不应伪造理由或修订。`);
      }
      continue;
    }

    if (path.rootAnswer === 'yes') {
      if (path.acceptedRevisionFrameId) {
        add(errors, 'YES_HAS_REVISION', `${profile.label}/${policyId} 根答案为 yes，却记录修订框架。`);
      }
      if (path.diagnosisClaimId !== policy.entry.supportClaimId) {
        add(errors, 'YES_DIAGNOSIS', `${profile.label}/${policyId} yes 路径应指向根支持命题。`, {
          expected: policy.entry.supportClaimId,
          actual: path.diagnosisClaimId,
        });
      }
    }

    if (path.rootAnswer === 'no') {
      if (path.acceptedRevisionFrameId) {
        if (!policy.frames[path.acceptedRevisionFrameId]) {
          add(errors, 'UNKNOWN_REVISION_FRAME', `${profile.label}/${policyId} 引用不存在的修订框架 ${path.acceptedRevisionFrameId}.`);
        }
        const diagnostic = policy.diagnostics.find((item) => item.id === path.diagnosticId);
        if (!diagnostic) {
          add(errors, 'ACCEPTED_REVISION_WITHOUT_DIAGNOSTIC', `${profile.label}/${policyId} 接受修订但没有有效 diagnosticId.`);
        } else {
          if (diagnostic.candidateFrameId !== path.acceptedRevisionFrameId) {
            add(errors, 'REVISION_FRAME_MISMATCH', `${profile.label}/${policyId} 的诊断与接受框架不一致。`);
          }
          if (diagnostic.acceptedClaimId !== path.diagnosisClaimId) {
            add(errors, 'REVISION_CLAIM_MISMATCH', `${profile.label}/${policyId} 的局部反对点与诊断不一致。`);
          }
        }
      } else if (path.diagnosisClaimId !== policy.fallbackOpposeClaimId) {
        add(errors, 'FALLBACK_CLAIM_MISMATCH', `${profile.label}/${policyId} 拒绝全部已测试修订后，应进入政策本身的反对命题。`, {
          expected: policy.fallbackOpposeClaimId,
          actual: path.diagnosisClaimId,
        });
      }
    }

    if (!allowedStress.has(path.stressResponse)) {
      add(errors, 'STRESS_RESPONSE', `${profile.label}/${policyId} 的压力测试回答无效。`, { response: path.stressResponse });
    }
    if (!allowedImpacts.has(path.counterImpact)) {
      add(errors, 'COUNTER_IMPACT', `${profile.label}/${policyId} 的相反理由影响无效。`, { impact: path.counterImpact });
    }
    const primary = path.canonicalReasonPath?.[0];
    if (primary && path.acceptablePrimaryReasonIds?.length && !path.acceptablePrimaryReasonIds.includes(primary)) {
      add(errors, 'PRIMARY_NOT_ACCEPTABLE', `${profile.label}/${policyId} 的规范路径首条理由不在可接受集合中。`, { primary });
    }

    validateReasonPath({
      profile,
      policyId,
      startClaimId: path.diagnosisClaimId,
      reasonIds: path.canonicalReasonPath || [],
      terminalValueId: path.terminalValueId,
      kind: 'main',
    });
    validateReasonPath({
      profile,
      policyId,
      startClaimId: path.counterClaimId,
      reasonIds: path.canonicalCounterReasonPath || [],
      terminalValueId: path.counterTerminalValueId,
      kind: 'counter',
    });
  }
}

// Formal model must not contain the benchmark labels. This prevents entertainment labels from leaking into the formal question bank.
const modelText = JSON.stringify(model).toLocaleLowerCase();
const leakedLabels = EXPECTED_LABELS.filter((label) => modelText.includes(label.toLocaleLowerCase()));
if (leakedLabels.length) {
  add(errors, 'IDEOLOGY_LABEL_LEAK', '正式模型中出现了意识形态基准标签。', { leakedLabels });
}

const sourceStatusCounts = benchmark.profiles.reduce((counts, profile) => {
  counts[profile.source.status] = (counts[profile.source.status] || 0) + 1;
  return counts;
}, {});
const provisionalCount = benchmark.profiles.filter((profile) => (
  profile.referenceStatus === 'provisional_reference_variant'
)).length;
if (provisionalCount !== 23) add(errors, 'PROVISIONAL_COUNT', `应有 23 个暂定参考，实际为 ${provisionalCount}.`);

const report = {
  schema: 'argument-chain-ideology-benchmark-validation',
  version: '1.2.2',
  ok: errors.length === 0,
  summary: {
    modelVersion: model.meta.version,
    profileCount: benchmark.profiles.length,
    policyCount: allPolicyIds.length,
    pathCount: benchmark.profiles.length * allPolicyIds.length,
    reasonCount: Object.keys(model.reasons).length,
    sourceStatusCounts,
    provisionalCount,
    errorCount: errors.length,
    warningCount: warnings.length,
  },
  errors,
  warnings,
};

if (!report.ok) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(report.summary, null, 2));
