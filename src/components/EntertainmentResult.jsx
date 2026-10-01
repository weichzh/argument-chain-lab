import React, { useEffect, useState } from 'react';
import { RefreshCw, BookOpen, Target } from 'lucide-react';
import { loadEntertainmentBenchmark } from '../data/bank.js';
import { matchEntertainment } from '../lib/entertainmentMatcher.js';
import ReferenceEvidence from './ReferenceEvidence.jsx';

const answerCopy = { yes: '接受原方案', no: '不接受原方案', uncertain: '不确定' };
const stressCopy = { apply: '仍然适用', qualified: '存在重要区别', retract: '撤回理由', uncertain: '不确定' };
const counterCopy = { no_change: '不改变判断', weaken: '有所犹豫', offset: '暂不能决定', reverse: '改变判断', uncertain: '影响不确定' };
const label = item => `${item.labelZh}（${item.label}）`;
const frameLabel = (model, policyId, frameId) => frameId
  ? model.policies.find(policy => policy.id === policyId)?.frames?.[frameId]?.label || frameId
  : '未接受已测试的修改';
const differenceText = (model, item) => {
  if (item.kind === 'different_answer') return `${item.policyTitle}：你记录为“${answerCopy[item.userAnswer]}”，参考记录为“${answerCopy[item.profileAnswer]}”。`;
  if (item.kind === 'different_revision_boundary') return `${item.policyTitle}：你接受“${frameLabel(model, item.policyId, item.userRevision)}”；参考记录为“${frameLabel(model, item.policyId, item.profileRevision)}”。`;
  if (item.kind === 'different_diagnosis') return `${item.policyTitle}：比较目标分别是“${item.userDiagnosis}”和“${item.profileDiagnosis}”。`;
  if (item.kind === 'different_terminal_value') return `${item.policyTitle}：你采用的更深理由是“${item.userTerminal}”，参考采用“${item.profileTerminal}”。`;
  if (['different_primary_reason', 'different_reason_path', 'different_counter_reason'].includes(item.kind)) return `${item.policyTitle}：你记录“${item.userReason}”，参考记录“${item.profileReason}”。`;
  if (item.kind === 'different_stress_response') return `${item.policyTitle}：相似案例的回答分别是“${stressCopy[item.userStressResponse]}”和“${stressCopy[item.profileStressResponse]}”。`;
  if (item.kind === 'different_counter_response') return `${item.policyTitle}：相反理由的影响分别是“${counterCopy[item.userCounterImpact]}”和“${counterCopy[item.profileCounterImpact]}”。`;
  return `${item.policyTitle}：记录不足，暂不能说明差异。`;
};
const sharedText = (model, item) => {
  if (item.kind === 'shared_revision_boundary') return `${item.policyTitle}：均接受修改方案“${frameLabel(model, item.policyId, item.frameId)}”。`;
  if (item.kind === 'shared_terminal_value') return `${item.policyTitle}：采用相同的更深理由“${item.valueLabel}”。`;
  if (item.kind === 'shared_reason_family') return `${item.policyTitle}：所选理由涉及相同的论证主题，但不一定是同一条理由。`;
  if (item.kind === 'shared_counter_response') return `${item.policyTitle}：相反理由对最终判断的影响相同。`;
  return `${item.policyTitle}：对原方案均记录为“${answerCopy[item.rootAnswer]}”。`;
};

function ReferenceComparison({ model, result, onTieBreaker }) {
  const candidates = result.displayStrategy.id === 'argument_profile_only' ? []
    : [...result.candidateGroup].sort((a, b) => a.labelZh.localeCompare(b.labelZh, 'zh-CN'));
  const completeness = result.recordCompleteness;
  return <section className="entertainment-results" aria-live="polite">
    <header className="entertainment-profile"><span>03 · 可选参考比较</span><h2>对照具体记录，不给人贴标签</h2>
      <p>以下卡片按名称排列，不表示立场优劣，也不是对你政治身份的判定。正式比较使用 {result.eligibleReferenceCount} 项已整理参考；测试用和待整理条目不进入这里。</p>
    </header>
    <p className="reference-records-note">
      你的记录：<strong>{completeness.policyCount}</strong> 个情景；其中 <strong>{completeness.selectedReasons}</strong> 题选过主要理由，<strong>{completeness.checkedReasons}</strong> 题有经过前提和原则核对的理由，<strong>{completeness.checkedCases}</strong> 题记录了相似案例检查。
      参考资料不足不会减少这些数量。不确定和资料缺失不作为相同立场的证据。
    </p>
    {candidates.length ? <>
      <h3>可供对照的参考记录</h3>
      <ul className="reference-card-grid">{candidates.map((item, candidateIndex) => {
        const comparablePolicies = Object.entries(item.policyDetails).filter(([, policy]) => Object.values(policy.featureScores).some(value => value != null));
        return <li key={item.profileId}>
          <h4>{label(item)}</h4>
          <p className="source-band">{item.sourceQuality.band}</p>
          <p>{item.comparisonKind === 'reason_paths' ? '本次包含理由层面的对照。' : '本次只对照了政策答案或修改边界，没有足够的双方理由记录。'}</p>
          <p>可对照 {comparablePolicies.length} 个情景。双方可比信息覆盖 {Math.round(item.comparisonCoveragePercent)}%：分母是你已确认且可用于比较的信息，不是身份概率。</p>
          <details className="reference-matrix-detail" open={candidateIndex < 2}><summary>查看逐项对照</summary><ReferenceEvidence candidate={item} /></details>
          <details className="reference-text-detail"><summary>文字摘要与具体差异</summary>
          {item.similarities?.length ? <><h5>实际相同的记录</h5><ul>{item.similarities.map((shared, index) => <li key={index}>{sharedText(model, shared)}</li>)}</ul></> : <p>当前没有足够记录来概括相同理由。</p>}
          {item.differences?.length ? <details><summary>具体差异（{item.differences.length} 项）</summary><ul>{item.differences.map((difference, index) => <li key={index}>{differenceText(model, difference)}</li>)}</ul></details> : <p>在现有可比字段中未记录到差异；不等于完整立场相同。</p>}
          </details>
          <details><summary>来源说明与限制</summary><p>{item.sourceQuality.note}</p>{item.anchor ? <p>{item.anchor}</p> : null}</details>
        </li>;
      })}</ul>
    </> : <p className="entertainment-caveat">{result.displayStrategy.note}</p>}
    {result.tieBreaker && onTieBreaker ? <section className="entertainment-tie-breaker">
      <div><h3>继续探索一个情景</h3><p>这些参考记录在这项政策的安排和理由上存在差异。补答是可选的，不影响已经保存的内容。</p></div>
      <button className="button secondary" type="button" onClick={() => onTieBreaker(result.tieBreaker.policyId)}><Target size={17} />再答一题：{result.tieBreaker.title}</button>
    </section> : null}
    <details className="result-exports"><summary>记录完整度与校验指纹</summary>
      <p>记录完整度 {result.reasoningDepthPercent}%：按已填字段计算的工程指标，只取决于你的记录，与参考对象无关。它不评价思想深度、能力或立场强度。</p>
      <p>已确认结构指纹 <code>{result.argumentProfile.fingerprint}</code>。只核对可比较的结构，不包含全部自由文本；不公开上传，也不代表身份。</p>
      <p>具体参考的可比覆盖只计算双方都有的信息；匹配时优先采用有足够资料支持的相同记录，不把缺失当作反对，也不让空缺自动获得接近分。</p>
    </details>
  </section>;
}

export default function EntertainmentResult({ enabled, manifest, model, policyResults, onEnable, onTieBreaker }) {
  const [status, setStatus] = useState({ loading: false, error: null, result: null });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    setStatus({ loading: true, error: null, result: null });
    loadEntertainmentBenchmark(manifest)
      .then(benchmark => matchEntertainment(model, benchmark, policyResults))
      .then(result => { if (active) setStatus({ loading: false, error: null, result }); })
      .catch(error => { if (active) setStatus({ loading: false, error: error instanceof Error ? error.message : String(error), result: null }); });
    return () => { active = false; };
  }, [enabled, manifest, model, policyResults, retry]);
  if (!enabled) return <section className="entertainment-opt-in">
    <div><span>可选娱乐结果</span><h2>再与参考记录对照</h2><p>在看清自己的判断以后，再比较具体的相同点、差异和资料缺口。参考名称不是身份结论，回答不会公开上传。</p></div>
    <button className="button secondary" type="button" onClick={onEnable}><BookOpen size={17} />生成娱乐匹配</button>
  </section>;
  if (status.loading) return <section className="entertainment-loading" role="status"><p>正在对照已确认的记录…</p></section>;
  if (status.error) return <section className="entertainment-error" role="alert"><div><h2>参考比较暂时不可用</h2><p>{status.error}</p><p>上面的实际回答仍然保留，可以继续阅读或导出。</p></div><button className="button secondary" type="button" onClick={() => setRetry(value => value + 1)}><RefreshCw size={17} />重新读取参考库</button></section>;
  return status.result ? <ReferenceComparison model={model} result={status.result} onTieBreaker={onTieBreaker} /> : null;
}
