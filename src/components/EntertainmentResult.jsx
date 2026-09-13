import React, { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, Target } from 'lucide-react';
import { loadEntertainmentBenchmark } from '../data/bank.js';
import { matchEntertainment } from '../lib/entertainmentMatcher.js';

const answerCopy = {
  yes: '应当',
  no: '不应当',
  uncertain: '不确定',
};

const stressCopy = {
  apply: '仍然适用',
  qualified: '存在重要区别',
  retract: '撤回这条理由',
  uncertain: '不确定',
};

const counterImpactCopy = {
  no_change: '不改变原判断',
  weaken: '有所犹豫但不改变结论',
  offset: '两边暂时抵消',
  reverse: '改变结论',
  uncertain: '影响不确定',
};

const percent = (value) => `${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}%`;

const ideologyLabel = (item) => (
  item?.labelZh ? `${item.labelZh}（${item.label}）` : item?.label || ''
);

const frameLabel = (model, policyId, frameId) => (
  frameId ? model.policies.find((policy) => policy.id === policyId)?.frames?.[frameId]?.label || frameId : '不接受已测试的修改'
);

const similarityCopy = (item, model) => ({
  shared_revision_boundary: `${item.policyTitle}：你们接受相同的修改方案“${frameLabel(model, item.policyId, item.frameId)}”。`,
  shared_terminal_value: `${item.policyTitle}：你们都把“${item.valueLabel}”作为更深理由。`,
  shared_reason_family: `${item.policyTitle}：你们选择的主要理由方向接近。`,
  shared_counter_response: `${item.policyTitle}：相反理由对你们判断的影响相同。`,
  shared_root_answer: `${item.policyTitle}：你们对原方案都选择“${answerCopy[item.rootAnswer]}”。`,
}[item.kind]);

const differenceCopy = (item, model) => {
  if (item.kind === 'different_answer') {
    return `${item.policyTitle}：你选择“${answerCopy[item.userAnswer]}”，该参考选择“${answerCopy[item.profileAnswer]}”。`;
  }
  if (item.kind === 'different_revision_boundary') {
    return `${item.policyTitle}：你接受“${frameLabel(model, item.policyId, item.userRevision)}”，该参考接受“${frameLabel(model, item.policyId, item.profileRevision)}”。`;
  }
  if (item.kind === 'different_diagnosis') {
    return `${item.policyTitle}：根判断相同，但你们定位到的判断目标分别是“${item.userDiagnosis}”和“${item.profileDiagnosis}”。`;
  }
  if (item.kind === 'different_terminal_value') {
    return `${item.policyTitle}：根判断相同，但你的更深理由停在“${item.userTerminal}”，该参考路径停在“${item.profileTerminal}”。`;
  }
  if (item.kind === 'different_primary_reason') {
    return `${item.policyTitle}：根判断相同；你的主要理由是“${item.userReason}”，该参考路径的主要理由是“${item.profileReason}”。`;
  }
  if (item.kind === 'different_reason_path') {
    return `${item.policyTitle}：根判断和主要理由相同，但后续理由路径分别经过“${item.userReason}”和“${item.profileReason}”。`;
  }
  if (item.kind === 'different_stress_response') {
    return `${item.policyTitle}：对相似案例，你选择“${stressCopy[item.userStressResponse]}”，该参考路径记录“${stressCopy[item.profileStressResponse]}”。`;
  }
  if (item.kind === 'different_counter_reason') {
    return `${item.policyTitle}：你认真考虑的相反理由是“${item.userReason}”，该参考路径记录的是“${item.profileReason}”。`;
  }
  if (item.kind === 'different_counter_response') {
    return `${item.policyTitle}：相反理由对你的影响是“${counterImpactCopy[item.userCounterImpact]}”，该参考路径记录的是“${counterImpactCopy[item.profileCounterImpact]}”。`;
  }
  return `${item.policyTitle}：当前记录不足以说明具体差异。`;
};

function PrototypeList({ items, model }) {
  return (
    <ol className="entertainment-prototype-list">
      {items.map((item) => (
        <li key={item.profileId}>
          <div><strong>{ideologyLabel(item)}</strong><span>论证路径相似度 {percent(item.similarityPercent)}</span></div>
          {!item.allowUniqueResult ? <small>参考名称，尚待独立整理</small> : null}
          <details className="prototype-source">
            <summary>来源说明</summary>
            <p>{item.sourceQuality.note}{item.anchor ? ` 整理依据：${item.anchor}` : ''}</p>
          </details>
          {item.presentation?.mode === 'neutral_contextualized' ? (
            <p className="prototype-risk">中性呈现，准确记录不等于道德认可。{item.differences?.length ? `主要差异：${differenceCopy(item.differences[0], model)}` : '当前已确认路径中尚未记录到实质差异。'}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function MatchedResult({ model, result, onTieBreaker }) {
  const nearest = result.nearestPrototype;
  const candidates = result.candidateGroup || [];
  const nearestDifferences = result.differencesFromNearest || [];
  const comparisonDifferences = nearestDifferences.length
    ? nearestDifferences
    : result.comparisonWithSecond?.differences || [];
  const differenceTitle = nearestDifferences.length
    ? '与最近参考的实质差异'
    : `与第二候选${result.comparisonWithSecond ? `“${ideologyLabel(result.comparisonWithSecond)}”` : ''}的关键差异`;

  return (
    <section className="entertainment-results" aria-live="polite">
      <header className="entertainment-profile">
        <span>你的论证型</span>
        <h2>{result.argumentProfile.label}</h2>
        <p>分享指纹 <code>{result.argumentProfile.fingerprint}</code></p>
        <small>{result.argumentProfile.caveat}</small>
      </header>

      <section className="entertainment-depth">
        <div><span>当前结果深度</span><h3>{result.resultStage.label}</h3><p>{result.resultStage.note}</p></div>
        <dl>
          <div><dt>政策覆盖</dt><dd>{percent(result.policyCoveragePercent)}</dd></div>
          <div><dt>论证深度</dt><dd>{percent(result.reasoningDepthPercent)}</dd></div>
          <div><dt>可比较信息覆盖</dt><dd>{percent(result.evidenceCoveragePercent)}</dd></div>
        </dl>
        <p className="metric-explanation">政策覆盖表示答过多少核心情景；论证深度表示留下了多少理由信息。这些百分比都不是身份概率。</p>
      </section>

      {result.displayStrategy.id === 'candidate_group' ? (
        <section className="entertainment-match-block">
          <h3>根据已答内容，以下几种参考路径与你比较接近。</h3>
          <PrototypeList items={candidates} model={model} />
          <p>{result.displayStrategy.note}</p>
        </section>
      ) : null}

      {result.displayStrategy.id === 'nearest_with_alternatives' && nearest ? (
        <section className="entertainment-match-block">
          <h3>目前最接近：{ideologyLabel(nearest)}</h3>
          <dl className="entertainment-nearest-details">
            <div><dt>论证路径相似度</dt><dd>{percent(nearest.similarityPercent)}</dd></div>
            <div><dt>第一、第二名差距</dt><dd>{Number(result.marginToSecond).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} 个百分点</dd></div>
          </dl>
          {result.referenceSourceNote ? (
            <details className="entertainment-source-note">
              <summary>来源说明</summary>
              <p>{result.referenceSourceNote.label}。{result.referenceSourceNote.note}{result.referenceSourceNote.anchor ? ` 整理依据：${result.referenceSourceNote.anchor}` : ''}</p>
            </details>
          ) : null}
          {result.alternatives.length ? <><h4>其他相近参考</h4><PrototypeList items={result.alternatives.slice(0, 3)} model={model} /></> : null}
        </section>
      ) : null}

      {result.decisiveSimilarities.length && result.displayStrategy.id !== 'argument_profile_only' ? (
        <section className="entertainment-explanation">
          <h3>为什么接近</h3>
          <ul>{result.decisiveSimilarities.slice(0, 3).map((item, index) => (
            <li key={`${item.kind}-${item.policyId}-${index}`}>{similarityCopy(item, model)}</li>
          ))}</ul>
        </section>
      ) : null}

      {comparisonDifferences.length && result.displayStrategy.id !== 'argument_profile_only' ? (
        <section className="entertainment-explanation">
          <h3>{differenceTitle}</h3>
          <ul>{comparisonDifferences.slice(0, 3).map((item, index) => (
            <li key={`${item.kind}-${item.policyId}-${index}`}>{differenceCopy(item, model)}</li>
          ))}</ul>
        </section>
      ) : null}

      {result.displayStrategy.id !== 'argument_profile_only'
        && result.presentation?.mode === 'neutral_contextualized' ? (
        <p className="entertainment-risk-note">{nearestDifferences.length
          ? '准确记录相似路径不等于道德认可；这里保持中性，并同时列出实质差异。'
          : '当前已确认路径中尚未记录到实质差异；准确记录相似路径仍不等于道德认可。'}</p>
      ) : null}
      <p className="entertainment-caveat">{result.displayCaveat}</p>

      {result.displayStrategy.id !== 'argument_profile_only' && result.tieBreaker && onTieBreaker ? (
        <section className="entertainment-tie-breaker">
          <div><h3>提高精度</h3><p>{result.tieBreaker.explanation}</p></div>
          <button className="button secondary" type="button" onClick={() => onTieBreaker(result.tieBreaker.policyId)}>
            <Target size={17} />再答一题：{result.tieBreaker.title}
          </button>
        </section>
      ) : null}
    </section>
  );
}

export default function EntertainmentResult({ enabled, manifest, model, policyResults, onEnable, onTieBreaker }) {
  const [status, setStatus] = useState({ loading: false, error: null, result: null });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    setStatus((current) => ({ ...current, loading: true, error: null }));
    loadEntertainmentBenchmark(manifest)
      .then((benchmark) => matchEntertainment(model, benchmark, policyResults))
      .then((result) => {
        if (active) setStatus({ loading: false, error: null, result });
      })
      .catch((error) => {
        if (active) setStatus({ loading: false, error: error instanceof Error ? error.message : String(error), result: null });
      });
    return () => { active = false; };
  }, [enabled, manifest, model, policyResults, retry]);

  if (!enabled) {
    return (
      <section className="entertainment-opt-in">
        <div><span>可选娱乐结果</span><h2>比较当前论证路径</h2><p>比较你的已答内容与参考库中的路径。这不是政治身份或人格判断，也不会公开你的回答。</p></div>
        <button className="button secondary" type="button" onClick={onEnable}><Sparkles size={17} />生成娱乐匹配</button>
      </section>
    );
  }
  if (status.loading && !status.result) return <section className="entertainment-loading" aria-live="polite"><span className="loading-line" /><p>正在比较当前论证路径…</p></section>;
  if (status.error) {
    return <section className="entertainment-error" role="alert"><p>{status.error}</p><button className="button secondary" type="button" onClick={() => setRetry((value) => value + 1)}><RefreshCw size={17} />重新读取</button></section>;
  }
  return status.result ? <MatchedResult model={model} result={status.result} onTieBreaker={onTieBreaker} /> : null;
}
