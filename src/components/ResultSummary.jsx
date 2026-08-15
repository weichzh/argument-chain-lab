import React from 'react';
import { ArrowRight, Download, House, ListChecks, RotateCcw } from 'lucide-react';
import { getClaimV4, getModelV4, getPolicyV4, getReasonV4 } from '../lib/modelV4.js';
import { summarizePolicyResult } from '../lib/decisionEngine.js';
import EntertainmentResult from './EntertainmentResult.jsx';

const rootAnswerCopy = {
  yes: '应当',
  no: '不应当',
  uncertain: '不确定',
  skipped: '已跳过',
};

const counterImpactCopy = {
  no_change: '相反理由没有改变结论。',
  weaken: '相反理由带来犹豫，但没有改变结论。',
  offset: '相反理由使两边暂时抵消。',
  reverse: '相反理由使最终判断发生改变。',
  uncertain: '相反理由的影响暂时不能确定。',
};

const reasonLabel = (status, counter = false) => ({
  accepted: counter ? '认真考虑的相反理由' : '主要理由',
  qualified: counter ? '有保留的相反理由' : '有保留的主要理由',
  retracted: counter ? '经检验撤回的相反理由' : '经检验撤回的理由',
  uncertain: counter ? '尚未确认的相反理由' : '尚未确认的理由',
  unchecked: counter ? '尚未检查的相反理由' : '尚未检查的主要理由',
  custom_unverified: counter ? '认真考虑的相反理由' : '主要理由',
}[status] || (counter ? '认真考虑的相反理由' : '主要理由'));

const stressResultCopy = (stress) => ({
  apply: '仍然适用',
  qualified: `存在重要区别：${stress.distinction}`,
  retract: '撤回这条理由',
  uncertain: '是否适用尚不确定',
}[stress.response] || '尚未检查');

const downloadResults = (state) => {
  const payload = {
    schema: 'argument-chain-results-export',
    version: 1,
    modelVersion: state.modelVersion,
    exportedAt: new Date().toISOString(),
    policyResults: state.policyResults,
  };
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `argument-chain-results-${state.modelVersion}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function DetailedPath({ path, title }) {
  if (!path) return null;
  if (path.customReason) {
    return (
      <section className="v4-proof-path">
        <h4>{title}</h4>
        <p>{path.customReason.argument?.title || path.customReason.text}</p>
        <small>自定义理由，尚未经过正式题库校验。</small>
      </section>
    );
  }
  return (
    <section className="v4-proof-path">
      <h4>{title}</h4>
      <ol>{path.steps.map((step) => {
        const reason = getReasonV4(step.reasonId);
        const bridge = getClaimV4(step.bridgeClaimId);
        return <li key={step.reasonId}><strong>{reason?.title}</strong><span>{bridge?.text}</span></li>;
      })}</ol>
      {path.stress ? <p>相似案例：{stressResultCopy(path.stress)}</p> : null}
    </section>
  );
}

export default function ResultSummary({ state, dispatch, sessionControls, bankManifest }) {
  const model = getModelV4();
  const results = Object.values(state.policyResults)
    .sort((left, right) => getPolicyV4(left.policyId).order - getPolicyV4(right.policyId).order);
  const inProgress = Boolean(state.startedAt && !state.policyResults[state.currentPolicyId]);
  const nextPolicyId = sessionControls.nextPolicyId;

  return (
    <main className="v4-results">
      <header className="v4-results-header">
        <div>
          <span>阶段结果</span>
          <h1>{results.length ? `已记录 ${results.length} 道题` : '这次还没有完成题目'}</h1>
          <p>{inProgress ? '当前题停在中途，回答仍保存在这个浏览器中。' : '结果只描述这次问卷中的判断，不推断政治身份。'}</p>
        </div>
        <div className="v4-results-actions">
          {inProgress ? <button className="button primary" type="button" onClick={() => dispatch({ type: 'START' })}>继续当前题<ArrowRight size={17} /></button> : null}
          {!inProgress && nextPolicyId ? <button className="button primary" type="button" onClick={() => dispatch({ type: 'OPEN_POLICY', policyId: nextPolicyId })}>继续下一题<ArrowRight size={17} /></button> : null}
          <button className="button secondary" type="button" onClick={() => dispatch({ type: 'OPEN_OVERVIEW' })}><ListChecks size={17} />题目列表</button>
          <button className="button quiet" type="button" disabled={!results.length} onClick={() => downloadResults(state)}><Download size={17} />导出结果</button>
          <button className="icon-button" type="button" title="回到主页" aria-label="回到主页" onClick={() => dispatch({ type: 'EXIT_TO_LANDING' })}><House size={19} /></button>
        </div>
      </header>

      {results.length ? (
        <EntertainmentResult
          enabled={state.entertainmentEnabled}
          manifest={bankManifest}
          model={model}
          policyResults={state.policyResults}
          onEnable={() => dispatch({ type: 'ENABLE_ENTERTAINMENT' })}
          onTieBreaker={inProgress ? null : (policyId) => dispatch({ type: 'OPEN_POLICY', policyId })}
        />
      ) : null}

      {results.length ? (
        <div className="v4-result-list">
          {results.map((result) => {
            const summary = summarizePolicyResult(model, result);
            const finalAnswer = result.finalRootAnswer ?? result.rootAnswer;
            const finalChanged = finalAnswer !== result.rootAnswer;
            return (
              <article className="v4-result-item" key={result.policyId}>
                <header><span>{summary.title}</span><strong>{finalChanged
                  ? `${rootAnswerCopy[result.rootAnswer]} → ${rootAnswerCopy[finalAnswer]}`
                  : rootAnswerCopy[result.rootAnswer]}</strong></header>
                <h2>{finalChanged ? `初始判断：${summary.summary}` : summary.summary}</h2>
                {finalChanged ? <p><b>复核后的最终判断：</b>{rootAnswerCopy[finalAnswer]}</p> : null}
                {summary.acceptedRevision ? <p><b>可接受的修改方案：</b>{summary.acceptedRevision}</p> : null}
                {summary.changes?.length ? (
                  <dl className="v4-result-changes">{summary.changes.map((change) => <React.Fragment key={change.dimensionId}><dt>{change.label}</dt><dd>{change.from} → {change.to}</dd></React.Fragment>)}</dl>
                ) : null}
                {summary.diagnosis ? <p><b>使判断改变的差异：</b>{summary.diagnosis}</p> : null}
                {summary.mainReasonTitle ? <p><b>{reasonLabel(summary.pathStatus)}：</b>{summary.mainReasonTitle}</p> : null}
                {summary.deeperReason ? <p><b>更深理由：</b>{summary.deeperReason}</p> : null}
                {summary.counterReasonTitle ? <p><b>{reasonLabel(summary.counterPathStatus, true)}：</b>{summary.counterReasonTitle}</p> : null}
                {counterImpactCopy[summary.counterImpact] ? <p><b>复核结果：</b>{counterImpactCopy[summary.counterImpact]}</p> : null}
                <details>
                  <summary>查看详细推理记录</summary>
                  <DetailedPath path={result.mainPaths?.[0]} title="主要理由路径" />
                  <DetailedPath path={result.counterPath} title="相反理由路径" />
                </details>
                <button className="button quiet" type="button" onClick={() => dispatch({ type: 'OPEN_POLICY', policyId: result.policyId })}><RotateCcw size={16} />重新回答这题</button>
              </article>
            );
          })}
        </div>
      ) : <div className="v4-empty-results"><p>完成或跳过一道题后，这里会出现普通语言摘要。</p></div>}
    </main>
  );
}
