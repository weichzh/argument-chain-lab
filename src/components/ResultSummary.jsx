import React from 'react';
import { ArrowRight, Download, House, ListChecks } from 'lucide-react';
import { getClaimV4, getModelV4, getReasonV4 } from '../lib/modelV4.js';
import { policyForRecord, summarizePolicyResult } from '../lib/decisionEngine.js';
import { recordCompleteness } from '../lib/entertainmentMatcher.js';
import { ANSWER_LABELS, UNCERTAINTY_LABELS, resultStatus, reasonStatusLabel, counterImpactLabel, attemptLabel, orderedResults, readableResults } from '../lib/resultPresentation.js';
import EntertainmentResult from './EntertainmentResult.jsx';
import RestartPolicyButton from './RestartPolicyButton.jsx';
import ResultAtlas from './ResultAtlas.jsx';
import BoundaryTrack from './BoundaryTrack.jsx';
import ReasoningMap from './ReasoningMap.jsx';
import '../styles-v13.css';
import '../styles-results.css';

const stressResultCopy = stress => ({
  apply: '仍然适用', qualified: `存在重要区别：${stress.distinction}`,
  retract: '撤回这条理由', uncertain: '是否适用尚不确定',
}[stress.response] || '尚未检查');

const downloadResults = (model, state, structured = false) => {
  const payload = structured ? JSON.stringify({
    schema: 'argument-chain-results-export', version: 2, modelVersion: state.modelVersion,
    exportedAt: new Date().toISOString(), policyResults: state.policyResults,
  }, null, 2) : readableResults(model, state.policyResults);
  const url = URL.createObjectURL(new Blob([`${payload}\n`], { type: structured ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `argument-chain-results-${state.modelVersion}.${structured ? 'json' : 'md'}`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function DetailedPath({ path, title, sourceModelVersion }) {
  if (!path) return null;
  const custom = path.customReason;
  const customTarget = path.customTargetClaimId ? getClaimV4(path.customTargetClaimId) : null;
  return <section className="v4-proof-path">
    <h4>{title}</h4>
    {path.selectedReasonId ? <p>已选择、尚未检验：{getReasonV4(path.selectedReasonId)?.title}</p> : null}
    {path.steps?.length ? <ol>{path.steps.map((step, index) => <li key={`${step.reasonId}-${index}`}>
      <strong>{getReasonV4(step.reasonId)?.title}</strong><span>{getClaimV4(step.bridgeClaimId)?.text}</span>
      {getReasonV4(step.reasonId)?.premises?.length ? <details className="recorded-premises"><summary>核对的前提（{getReasonV4(step.reasonId).premises.length} 项）</summary>
        <ul>{getReasonV4(step.reasonId).premises.map(premise => <li key={premise.id}><p>{premise.statement}</p><small>{({ accept: '作答时暂时采用', reject: '未接受', uncertain: '不确定' })[step.premiseAnswers?.[premise.id]] || '旧记录未保存回答'}</small></li>)}</ul>
        <p>原则判断：{step.ruleAnswer === 'accept' ? '已明确认可其构成一个理由' : '未保存明确认可记录'}</p>
      </details> : null}
    </li>)}</ol> : null}
    {custom ? <div className="v4-custom-detail">
      <h5>{path.steps?.length ? '补充的更深理由' : '自定义理由'}</h5>
      {customTarget ? <p><b>这条理由说明的是：</b>{custom.target?.text || customTarget.text}</p> : null}
      {!customTarget && path.steps?.length ? <p>旧记录没有标明这段补充文字的说明对象；这里保留原文，不替你重新解释。</p> : null}
      {sourceModelVersion && sourceModelVersion !== getModelV4().meta.version ? <small>这段补充来自题库 {sourceModelVersion}，保留当时的文字，不替你重新解释。</small> : null}
      <p>{custom.argument?.title || custom.text}</p>
      {custom.argument?.summary ? <p>{custom.argument.summary}</p> : null}
      {custom.facts?.length ? <><h5>整理时采用的假设（尚未逐项检验）</h5><ul>{custom.facts.map((fact, index) => <li key={index}>{fact.statement}</li>)}</ul></> : null}
      {custom.bridge ? <p><b>整理后的判断依据：</b>{custom.bridge.text}</p> : null}
      {custom.stressTest ? <><h5>待检查的相似案例</h5><p>{custom.stressTest.scenario}</p><p>{custom.stressTest.question}</p></> : null}
      <small>自定义理由尚未经过正式题库校验；保存不等于证明或通过检验。</small>
    </div> : null}
    {path.status === 'unresolved' ? <p>追问暂时停在这里，理由尚未补全；前面已经记录的步骤仍然保留。</p> : null}
    {path.stress ? <section className="recorded-stress">
      <h5>相似案例检查</h5>
      {path.stress.principle ? <p><b>当时采用的原则：</b>{path.stress.principle}</p> : null}
      {path.stress.scenario ? <p>{path.stress.scenario}</p> : null}
      {path.stress.question ? <p>{path.stress.question}</p> : null}
      <p>你的回答：{stressResultCopy(path.stress)}</p>
      {sourceModelVersion && sourceModelVersion !== getModelV4().meta.version ? <small>这是题库 {sourceModelVersion} 中的回答，未重新执行现版案例检查。</small> : null}
    </section> : null}
  </section>;
}

export default function ResultSummary({ state, dispatch, sessionControls, bankManifest }) {
  const model = getModelV4();
  const results = orderedResults(model, state.policyResults);
  const completeness = recordCompleteness(model, state.policyResults, state.policyIds);
  const inProgress = Boolean(state.startedAt && !state.policyResults[state.currentPolicyId]);
  const nextPolicyId = sessionControls.nextPolicyId;
  return <main className="v4-results v13-results visual-results">
    <header className="v4-results-header">
      <div>
        <span>阶段结果 · 已记录 {results.length} 道题</span>
        <h1>{results.length ? '这次判断的边界' : '这次还没有完成题目'}</h1>
        <p>{inProgress ? '当前题停在中途，回答仍保存在这个浏览器中。' : '先看你的实际判断、可接受修改和未确定处。每张卡片都对应一道题，不推断政治身份。'}</p>
      </div>
      <div className="v4-results-actions">
        {inProgress ? <button className="button primary" type="button" onClick={() => dispatch({ type: 'START' })}>继续当前题<ArrowRight size={17} /></button> : null}
        {!inProgress && nextPolicyId ? <button className="button primary" type="button" onClick={() => dispatch({ type: 'OPEN_POLICY', policyId: nextPolicyId })}>继续下一题<ArrowRight size={17} /></button> : null}
        <button className="button secondary" type="button" onClick={() => dispatch({ type: 'OPEN_OVERVIEW' })}><ListChecks size={17} />题目列表</button>
        <button className="button quiet" type="button" disabled={!results.length} onClick={() => downloadResults(model, state)}><Download size={17} />导出结果</button>
        <button className="icon-button" type="button" aria-label="回到主页" onClick={() => dispatch({ type: 'EXIT_TO_LANDING' })}><House size={19} /></button>
      </div>
    </header>
    <ResultAtlas model={model} state={state} dispatch={dispatch} />
    {results.length ? <>
      <dl className="record-stats" aria-label="本轮记录概况">
        <div><dt>有作答记录的情景</dt><dd>{completeness.policyCount}<small>/ {state.policyIds.length}</small></dd></div>
        <div><dt>选过主要理由</dt><dd>{completeness.selectedReasons}<small>题</small></dd></div>
        <div><dt>核对相似案例</dt><dd>{completeness.checkedCases}<small>题</small></dd></div>
        <div><dt>考虑过相反理由</dt><dd>{completeness.counterReasons}<small>题</small></dd></div>
      </dl>
      <div className="visual-section-header"><span className="section-eyebrow">02 · 判断边界</span><h2>哪些安排改变了你的判断</h2><p>点选方案看差异，展开记录看理由。原方案、修改方案和复核后的判断分别保留。</p></div>
      <div className="v4-result-list">
        {results.map(result => {
          const summary = summarizePolicyResult(model, result);
          const status = resultStatus(result);
          const finalAnswer = result.finalRootAnswer ?? result.rootAnswer;
          const finalChanged = finalAnswer !== result.rootAnswer;
          const hasDetails = ['yes', 'no'].includes(result.rootAnswer) || Boolean(result.mainPaths?.length || result.counterPath || result.rejectedReasonAttempts?.length || Object.keys(result.revisionAnswers || {}).length);
          const canReview = (state.currentPolicyId === result.policyId && state.reviewCheckpoint) || state.policyDrafts?.[result.policyId]?.reviewCheckpoint;
          return <article className={`v4-result-item card-state-${status.id}`} id={`result-${result.policyId}`} key={result.policyId} tabIndex={-1}>
            <header><h2>{summary.title}</h2><span className={`decision-badge ${status.id}`}>{status.label}</span></header>
            <p className="result-lead">{finalChanged ? '初始记录：' : ''}{summary.summary}</p>
            {finalChanged ? <p><b>复核后的最终判断：</b>{ANSWER_LABELS[finalAnswer]}</p> : null}
            {summary.acceptedRevision ? <p><b>{finalChanged ? '当时接受的修改方案：' : '可接受的修改方案：'}</b>{summary.acceptedRevision}</p> : null}
            {summary.unresolvedRevision ? <p><b>尚未确定是否接受的修改：</b>{summary.unresolvedRevision}</p> : null}
            {summary.acceptedRevision && summary.diagnosis ? <p><b>已确认足以改变判断的差异：</b>{summary.diagnosis}</p> : null}
            <BoundaryTrack model={model} result={result} />
            {summary.mainReasonTitle ? <p><b>{reasonStatusLabel(summary.pathStatus)}：</b>{summary.mainReasonTitle}</p> : null}
            {summary.deeperReason ? <p><b>更深理由：</b>{summary.deeperReason}</p> : null}
            {summary.reasonUnresolved ? <p className="result-caveat">判断已记录，理由尚未补全；这不代表你没有理由。</p> : null}
            {summary.customUnverified ? <p className="result-caveat">包含你补充的理由，尚未经过题库校验。完整内容保留在下方详细记录中。</p> : null}
            {summary.customTargetUnrecorded ? <p className="result-caveat">旧记录未标明补充理由的说明对象，这里不替你重新解释。</p> : null}
            {summary.counterReasonTitle ? <p><b>{reasonStatusLabel(summary.counterPathStatus, true)}：</b>{summary.counterReasonTitle}</p> : null}
            {['yes', 'no'].includes(result.rootAnswer) ? <p><b>复核记录：</b>{counterImpactLabel(result)}</p> : null}
            {Object.entries(result.uncertaintyByFrame || {}).map(([frameId, note]) => <p key={frameId}><b>未确定处（{policyForRecord(model, result.policyId, result.sourceModelVersion)?.frames[frameId]?.label || '旧记录未标明方案'}）：</b>{UNCERTAINTY_LABELS[note.category] || '未分类'}{note.text ? `；${note.text}` : ''}</p>)}
            {result.sourceModelVersion && result.sourceModelVersion !== model.meta.version ? <small className="source-notice">来自题库 {result.sourceModelVersion}；保留旧回答，不自动重新执行修订后的检验。</small> : null}
            {hasDetails ? <details className="reasoning-detail">
              <summary>查看详细推理记录</summary>
              <ReasoningMap model={model} result={result} />
              <div className="source-records-heading">原始理由、前提与案例</div>
              <DetailedPath path={result.mainPaths?.[0]} sourceModelVersion={result.sourceModelVersion} title="主要理由路径" />
              <DetailedPath path={result.counterPath} sourceModelVersion={result.sourceModelVersion} title="相反理由路径" />
              {result.rejectedReasonAttempts?.length ? <section className="rejected-attempts"><h4>已尝试但未确认的理由</h4>{result.rejectedReasonAttempts.map((attempt, index) => <p key={index}><b>{model.reasons[attempt.reasonId]?.title || attempt.reasonId}</b><br />{attemptLabel(attempt)}</p>)}</section> : null}
              {summary.revisionHistory?.length ? <section><h4>实际比较过的修改</h4>{summary.revisionHistory.map(item => <p key={item.frameId}>{item.label}：{({ accept: '接受', reject: '不接受', uncertain: '不确定' })[item.response]}</p>)}</section> : null}
            </details> : null}
            <footer className="result-card-actions">
            {canReview ? <button className="button secondary" type="button" onClick={() => dispatch({ type: 'OPEN_POLICY', policyId: result.policyId })}>继续核对理由</button> : null}
            <RestartPolicyButton policyId={result.policyId} title={summary.title} dispatch={dispatch} />
            <a href="#result-atlas-title">返回总览 ↑</a>
            </footer>
          </article>;
        })}
      </div>
      <details className="result-exports"><summary>结构化数据与导出说明</summary><p>“导出结果”生成可阅读的 Markdown，包含判断、修改、理由和未确定处。下面的 JSON 用于复核结构；两者都不包含 AI 配置、密钥或浏览器资料。</p><button className="button quiet" type="button" onClick={() => downloadResults(model, state, true)}>导出结构化 JSON</button></details>
      <EntertainmentResult enabled={state.entertainmentEnabled} manifest={bankManifest} model={model} policyResults={state.policyResults} onEnable={() => dispatch({ type: 'ENABLE_ENTERTAINMENT' })} onTieBreaker={inProgress ? null : policyId => dispatch({ type: 'OPEN_POLICY', policyId })} />
    </> : <div className="v4-empty-results"><p>完成或跳过一道题后，这里会出现普通语言摘要。</p></div>}
  </main>;
}
