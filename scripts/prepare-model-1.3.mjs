#!/usr/bin/env node
/** Reproducible, additive content edition. Never edit the 1.2.2 backing files. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateModel } from '../src/lib/decisionEngine.js';
const bank = new URL('../public/bank/', import.meta.url);
const read = name => JSON.parse(fs.readFileSync(new URL(name, bank), 'utf8'));
const originalBytes = fs.readFileSync(new URL('model-1.2.2.json', bank));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(digest(originalBytes), '035b8ec3a5b67c71d627a0b6280a35360e11386c78f8198c207293f22595f376');
const original = JSON.parse(originalBytes);
const model = structuredClone(original);
const benchmark = read('ideology-benchmark-1.2.2.json');
const remap = (value, replacements) => {
  let json = JSON.stringify(value);
  for (const [from, to] of Object.entries(replacements)) json = json.replaceAll(from, to);
  return JSON.parse(json);
};
const replacements = {};
const changedBridges = {};
const retireReason = (oldId, transform, bridge = null) => {
  const newId = `${oldId}__v130`;
  const old = original.reasons[oldId];
  assert(old, `Missing baseline reason ${oldId}`);
  const ids = { [oldId]: newId, ...(bridge ? { [old.bridgeClaimId]: bridge.id } : {}) };
  const reason = remap(old, ids);
  transform(reason);
  model.reasons[newId] = reason;
  replacements[oldId] = newId;
  for (const [entityId, entity] of Object.entries(original.formalEntities)) {
    if (entityId.includes(oldId) || (bridge && entityId === `claim:${old.bridgeClaimId}`)) {
      const key = Object.entries(ids).reduce((text, [from, to]) => text.replaceAll(from, to), entityId);
      model.formalEntities[key] = remap(entity, ids);
    }
  }
  if (bridge) {
    const claim = remap(original.claims[old.bridgeClaimId], { [old.bridgeClaimId]: bridge.id });
    Object.assign(claim, { id: bridge.id, text: bridge.text, plain: bridge.plain,
      terminalCandidate: true, whenUserContinuesPastCandidate: 'offer_custom_deeper_reason',
      stressTest: { ...claim.stressTest, scenario: bridge.scenario, question: bridge.question } });
    model.claims[bridge.id] = claim;
    changedBridges[newId] = bridge.id;
  }
};
retireReason('r_speech_support_participation', reason => {
  reason.summary = '如果原方案的法律处罚确实缓解了可识别的公共参与排斥，这可以成为支持方案的一项理由；仍须分别考虑限制表达的代价。';
  reason.premises[0].statement = '在本题的假设中，原方案的法律处罚能够缓解可识别的公共参与排斥，而不只是压低投诉数量。';
  reason.premises[0].question = '你愿意暂时假设：原方案的法律处罚确实能够缓解上述公共参与排斥吗？';
  reason.premises[1].statement = '能否以平等身份参与公共生活，与当前的法律处罚判断有关。';
  reason.premises[1].question = '能否以平等身份参与公共生活，与这里是否采用法律处罚的判断有关吗？';
  reason.tags = [...(reason.tags || []).filter(tag => !tag.startsWith('reason-family:')), 'reason-family:equal_participation'];
}, {
  id: 'n_equal_public_participation', plain: '公共参与受到排斥值得单独考虑',
  text: '公共参与因可识别的排斥而受损时，这种影响值得在政策判断中考虑；它不单独决定采用哪种法律手段。',
  scenario: '一项你赞同的公开倡议，使持不同意见的一些居民持续退出社区听证。现在有可核实的退出记录，但尚未证明处罚倡议者就是负担最小的办法。',
  question: '你仍把公共参与受损作为需要考虑的理由，同时区分是否必须处罚吗？',
});
retireReason('r_workplace_veto_deadlock', reason => {
  reason.summary = '在缺少期限、调解和复核机制时，长期僵局可能阻碍必要调整。这个担忧针对争议解决，不预先决定资本或劳动者应拥有全部控制权。';
  reason.tags = [...(reason.tags || []).filter(tag => !tag.startsWith('reason-family:')), 'reason-family:decision_process'];
}, {
  id: 'n_accountable_dispute_resolution', plain: '参与权与可问责的争议解决需要同时安排',
  text: '重大决定既应容纳受影响者的表达，也需要可公开检验的期限、协调和复核机制，避免各方无限期阻断决定。',
  scenario: '一家由劳动者共同持有的企业需要应对订单骤降。成员都保有表达权，但没有调解或决定期限，一项关系到企业存续的调整已被相互否决半年。',
  question: '你仍认为需要争议解决机制，而不是据此认定某一方必须独占控制权吗？',
});
for (const [id, reason] of Object.entries(original.reasons)) {
  if (reason.formalization?.policyId !== 'metadata_surveillance') continue;
  if (!reason.title.includes('只有把范围') && !reason.summary.includes('最低组合')) continue;
  retireReason(id, updated => {
    const risk = reason.title.includes('只有把范围');
    updated.title = risk ? '这一组修改已足以回应我对收集风险的担忧' : '这一组限制让我认为本次收集负担可以接受';
    updated.summary = risk
      ? '本轮确认收集范围、期限和监督的组合已经足够；没有比较所有子集，因此不声称每项修改都不可缺少。'
      : '这些限制合在一起，使这个完整修改方案可接受；这不表示找到了必要条件、最小组合或最佳方案。';
    for (const premise of updated.premises) {
      if (risk && premise.role === 'failure_path') {
        premise.statement = '在已经测试的单项修改中，剩余环节仍保留了令我担忧的收集能力；本次组合修改已足以降低这种风险。';
      }
      premise.question = `你是否愿意暂时采用这个前提：${premise.statement.replace(/。$/, '')}？`;
    }
  });
}
model.meta = { ...model.meta, version: '1.3.0', updatedAt: '2026-10-01', replaces: 'argument-chain-core@1.2.2',
  compatibleSessionVersions: ['1.0.0', '1.1.0', '1.2.0', '1.2.2'] };
model.meta.notes.push('1.3.0 将四条被修订理由保留为只读旧定义，正式选择使用新 ID；旧记录不会被自动重检。');
model.product.retiredReasonIds = Object.keys(replacements);
model.product.revisedFramePolicyIds = ['expert_referendum_delay'];
model.product.frameHistory = {};
for (const [version, filename] of [['1.0.0', 'legacy/model-1.0.0.json'], ['1.1.0', 'model-1.1.0.json'], ['1.2.0', 'model-1.2.0.json'], ['1.2.2', 'model-1.2.2.json']]) {
  if (!fs.existsSync(new URL(filename, bank))) continue;
  const historical = read(filename).policies?.find(policy => policy.id === 'expert_referendum_delay');
  if (historical) model.product.frameHistory[version] = { expert_referendum_delay: historical };
}
for (const policy of model.policies) {
  model.claims[policy.fallbackOpposeClaimId].text = `不应按题目中的完整原方案实施“${policy.shortTitle}”。这不等于反对所有其他可能方案。`;
}
const expert = model.policies.find(policy => policy.id === 'expert_referendum_delay');
expert.dimensions.authority.values.thirty_day_advisory_delay.label = '专家只能建议暂停，由议会决定是否暂停，期限最多三十天';
for (const diagnostic of expert.diagnostics) {
  diagnostic.question = diagnostic.question.replace('专家只能提出暂停建议，而且最多延迟三十天', '专家只能提出暂停建议，必须由议会决定是否暂停，暂停最多三十天')
    .replace('专家最多只能建议延迟三十天', '专家只能建议，由议会决定是否暂停，暂停最多三十天');
}
for (const frame of Object.values(expert.frames)) {
  if (frame.label?.includes('三十天建议性延迟')) frame.label = frame.label.replace('三十天建议性延迟', '议会决定的三十天暂停');
}
const rewritePath = (ids = []) => {
  const mapped = ids.map(id => replacements[id] || id);
  const changedIndex = mapped.findIndex(id => changedBridges[id]);
  return changedIndex < 0 ? { ids: mapped } : { ids: mapped.slice(0, changedIndex + 1), terminal: changedBridges[mapped[changedIndex]] };
};
for (const profile of benchmark.profiles) {
  for (const path of Object.values(profile.expectedPaths)) {
    const main = rewritePath(path.canonicalReasonPath);
    const counter = rewritePath(path.canonicalCounterReasonPath);
    path.canonicalReasonPath = main.ids;
    path.canonicalCounterReasonPath = counter.ids;
    if (path.acceptablePrimaryReasonIds) path.acceptablePrimaryReasonIds = path.acceptablePrimaryReasonIds.map(id => replacements[id] || id);
    if (main.terminal) path.terminalValueId = main.terminal;
    if (counter.terminal) path.counterTerminalValueId = counter.terminal;
  }
}
benchmark.version = '1.3.0';
benchmark.targetModelVersion = '1.3.0';
if (benchmark.meta) benchmark.meta = { ...benchmark.meta, version: '1.3.0', targetModelVersion: '1.3.0' };
const report = validateModel(model);
assert(report.ok, report.errors.join('\n'));
const write = (name, value) => fs.writeFileSync(new URL(name, bank), `${JSON.stringify(value, null, 2)}\n`);
write('model-1.3.0.json', model);
write('ideology-benchmark-1.3.0.json', benchmark);
const manifest = read('manifest.json');
manifest.default = '1.3.0';
manifest.models = [{ version: '1.3.0', schemaVersion: 4, path: 'model-1.3.0.json', status: 'current', title: '可恢复的判断边界、可追溯理由与独立记录完整度' }];
manifest.entertainmentBenchmark = { ...manifest.entertainmentBenchmark, version: '1.3.0', targetModelVersion: '1.3.0', path: 'ideology-benchmark-1.3.0.json' };
if (!manifest.legacy.some(item => item.version === '1.2.2')) manifest.legacy.push({ version: '1.2.2', path: 'model-1.2.2.json', status: 'archive_only', loadInProduct: false });
write('manifest.json', manifest);
assert.equal(digest(fs.readFileSync(new URL('model-1.2.2.json', bank))), digest(originalBytes));
console.log(JSON.stringify({ version: model.meta.version, policies: model.policies.length, reasons: Object.keys(model.reasons).length,
  retiredReasons: model.product.retiredReasonIds, originalSha256: digest(originalBytes), currentSha256: digest(fs.readFileSync(new URL('model-1.3.0.json', bank))) }, null, 2));
