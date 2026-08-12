import React, { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, Target } from 'lucide-react';
import { loadEntertainmentBenchmark } from '../data/bank.js';
import { matchEntertainment } from '../lib/entertainmentMatcher.js';

const answerCopy = {
  yes: '应当',
  no: '不应当',
  uncertain: '不确定',
};

const percent = (value) => `${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}%`;

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
    return `${item.policyTitle}：你选择“${answerCopy[item.userAnswer]}”，该原型选择“${answerCopy[item.profileAnswer]}”。`;
  }
  if (item.kind === 'different_revision_boundary') {
    return `${item.policyTitle}：你接受“${frameLabel(model, item.policyId, item.userRevision)}”，该原型接受“${frameLabel(model, item.policyId, item.profileRevision)}”。`;
  }
  if (item.kind === 'same_answer_different_reason') {
    const userReason = item.userTerminal || item.userReason || '当前理由';
    const profileReason = item.profileTerminal || item.profileReason || '另一条理由';
    return `${item.policyTitle}：根判断相同，但你更重视“${userReason}”，该原型更重视“${profileReason}”。`;
  }
  return `${item.policyTitle}：你和该原型对相反理由的反应不同。`;
};

function PrototypeList({ items, model }) {
  return (
    <ol className="entertainment-prototype-list">
      {items.map((item) => (
        <li key={item.profileId}>
          <div><strong>{item.label}</strong><span>论证路径相似度 {percent(item.similarityPercent)}</span></div>
          <small>{item.sourceQuality.band}{item.anchor ? ` · ${item.anchor}` : ''}</small>
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
  const candidates = [nearest, ...result.alternatives].filter(Boolean).slice(0, 3);
  const nearestDifferences = result.differencesFromNearest || [];
  const comparisonDifferences = nearestDifferences.length
    ? nearestDifferences
    : result.comparisonWithSecond?.differences || [];
  const differenceTitle = nearestDifferences.length
    ? '与最近原型的实质差异'
    : `与第二候选${result.comparisonWithSecond ? `“${result.comparisonWithSecond.label}”` : ''}的关键差异`;

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
          <div><dt>综合证据覆盖</dt><dd>{percent(result.evidenceCoveragePercent)}</dd></div>
        </dl>
      </section>

      {result.displayStrategy.id === 'candidate_group' ? (
        <section className="entertainment-match-block">
          <h3>只看目前的信息，你位于以下几个论证原型之间。</h3>
          <PrototypeList items={candidates} model={model} />
          <p>这些原型在已经回答的问题上接近，但可接受修改和更深理由仍不同。</p>
        </section>
      ) : null}

      {result.displayStrategy.id === 'nearest_with_alternatives' && nearest ? (
        <section className="entertainment-match-block">
          <h3>基准库中较近：{nearest.label}</h3>
          <dl className="entertainment-nearest-details">
            <div><dt>论证路径相似度</dt><dd>{percent(nearest.similarityPercent)}</dd></div>
            <div><dt>第一、第二名差距</dt><dd>{percent(result.marginToSecond)}</dd></div>
            <div><dt>来源</dt><dd>{nearest.sourceQuality.band}</dd></div>
            <div><dt>锚点</dt><dd>{nearest.anchor}</dd></div>
          </dl>
          {result.alternatives.length ? <><h4>其他较近原型</h4><PrototypeList items={result.alternatives.slice(0, 3)} model={model} /></> : null}
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
        <div><span>可选娱乐结果</span><h2>比较当前论证路径</h2><p>独立基准只在你主动打开后读取，不会把原型标签写回正式题库。</p></div>
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
