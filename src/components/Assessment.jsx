import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  CircleHelp,
  ListChecks,
  LogOut,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  assessmentModes,
  claims,
  dilemmas,
  facts,
  getArgumentsForClaim,
  getRelevantDilemmas,
  policies,
} from '../data/model.js';
import { sessionDraftKey } from '../hooks/useSession.js';
import {
  canNominateClaim,
  collectTerminalCommitments,
  getCurrentArgument,
  getCurrentBridge,
  getCurrentFact,
  getCurrentPolicy,
  getCurrentTargetClaim,
  PHASES,
} from '../lib/engine.js';
import ProofView from './ProofView.jsx';

const STAGES = [
  ['判断', [PHASES.STANCE, PHASES.DIRECTION, PHASES.ARGUMENT]],
  ['事实', [PHASES.FACT]],
  ['原则', [PHASES.BRIDGE, PHASES.DEPTH]],
  ['价值', [PHASES.TERMINAL_CONFIRM]],
  ['检验', [
    PHASES.STRESS,
    PHASES.CONFLICT,
    PHASES.BROKEN,
    PHASES.POLICY_COMPLETE,
    PHASES.DILEMMA_INTRO,
    PHASES.DILEMMA,
  ]],
];

const stageFor = (phase) => STAGES.findIndex(([, phases]) => phases.includes(phase));

function StageRail({ phase }) {
  const active = stageFor(phase);
  return (
    <aside className="stage-rail" aria-label="当前题目进度">
      <strong>本题进度</strong>
      <ol>
        {STAGES.map(([label], index) => (
          <li key={label} className={index === active ? 'active' : index < active ? 'done' : ''}>
            <span>{index < active ? <Check size={14} /> : index + 1}</span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function ChoiceList({ options }) {
  return (
    <div className="choice-list">
      {options.map((option) => (
        <button key={option.id} className={`choice-row${option.tone ? ` ${option.tone}` : ''}`} type="button" onClick={option.onSelect} disabled={option.disabled}>
          <span className="choice-radio" aria-hidden="true" />
          <strong>{option.label}</strong>
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

function FreeInput({ state, dispatch, onAskAi, aiLoading, scope = 'current_target' }) {
  const policy = getCurrentPolicy(state);
  const key = sessionDraftKey(`${state.phase}:${state.currentTargetClaimId || policy?.id || 'root'}`);
  const [draft, setDraft] = useState(() => {
    try {
      return window.sessionStorage.getItem(key) || '';
    } catch {
      return '';
    }
  });
  const [saveGapSummary, setSaveGapSummary] = useState(false);

  useEffect(() => {
    try {
      setDraft(window.sessionStorage.getItem(key) || '');
    } catch {
      setDraft('');
    }
    setSaveGapSummary(false);
  }, [key]);

  const update = (value) => {
    setDraft(value);
    try {
      if (value) window.sessionStorage.setItem(key, value);
      else window.sessionStorage.removeItem(key);
    } catch {
      // The draft remains available in component memory.
    }
  };

  return (
    <details className="free-input-details" id="free-input">
      <summary>没有合适选项</summary>
      <section className="free-input">
        <label htmlFor={key}>补充我的想法</label>
        <textarea
          id={key}
          rows={3}
          value={draft}
          onChange={(event) => update(event.target.value)}
          placeholder="写下你的判断、理由或需要补充的条件…"
        />
        <div className="free-input-actions">
          <p>原文默认不会写入本地进度；只有选择 AI 梳理时才会发送。</p>
          {draft.trim() ? (
            <label className="gap-summary-consent">
              <input type="checkbox" checked={saveGapSummary} onChange={(event) => setSaveGapSummary(event.target.checked)} />
              <span>把前 400 字作为题库缺口摘要保存到本地和导出中</span>
            </label>
          ) : null}
          <button
            className="button quiet"
            type="button"
            onClick={() => {
              const summary = saveGapSummary ? draft.trim() : null;
              update('');
              setSaveGapSummary(false);
              dispatch({ type: 'NO_ARGUMENT', summary });
            }}
          >
            记录题库缺口并结束本题
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={!draft.trim() || aiLoading}
            onClick={() => onAskAi({ text: draft.trim(), scope, draftKey: key })}
          >
            <Sparkles size={17} /> {aiLoading ? '正在生成候选…' : '交给 AI 继续梳理'}
          </button>
        </div>
      </section>
    </details>
  );
}

const directionCopy = {
  support: '支持题设',
  oppose: '反对题设',
  undecided: '方向未定',
};

function PolicyFrame({ state }) {
  const policy = getCurrentPolicy(state);
  if (!policy || [PHASES.DILEMMA, PHASES.DILEMMA_INTRO].includes(state.phase)) return null;
  const record = state.records[policy.id];
  const direction = state.currentChain?.direction || record?.direction || record?.stance;
  const tone = direction === 'support' || direction === 'oppose' ? direction : 'neutral';
  return (
    <section className={`policy-frame ${tone}`} aria-label="本题题设">
      <header>
        <span>题设</span>
        <strong className={`direction-badge ${tone}`}>{directionCopy[direction] || '尚未作答'}</strong>
      </header>
      <h2>{policy.shortTitle || policy.title}</h2>
      <p>{policy.proposition}</p>
      {policy.scope ? <details><summary>查看题设边界</summary><p>{policy.scope}</p></details> : null}
    </section>
  );
}

function QuestionHeader({ state, label, title, statement }) {
  const policy = getCurrentPolicy(state);
  const argument = getCurrentArgument(state);
  const progress = state.phase === PHASES.FACT && argument
    ? `事实 ${state.currentFactIndex + 1} / ${argument.factIds.length}`
    : label;
  return (
    <>
      <PolicyFrame state={state} />
      <div className="question-context">
        <strong>{progress}</strong>
      </div>
      <header className="question-heading">
        <h1>{title}</h1>
        {statement && statement !== policy?.proposition ? <p>{statement}</p> : null}
      </header>
    </>
  );
}

function StanceQuestion({ state, dispatch, onAskAi, aiLoading }) {
  const policy = getCurrentPolicy(state);
  if (policy?.origin === 'community') {
    return (
      <>
        <QuestionHeader state={state} label="公开论证" title="沿着这份公开论证开始核对吗？" statement={policy.proposition} />
        <ChoiceList options={[
          {
            id: 'direct',
            label: '开始逐项核对这份论证',
            onSelect: () => {
              dispatch({ type: 'SET_STANCE', stance: policy.directDirection });
              dispatch({ type: 'SELECT_ARGUMENT', argumentId: policy.directArgumentId });
            },
          },
          {
            id: 'skip',
            label: '暂不使用这份公开论证',
            onSelect: () => dispatch({ type: 'SKIP_POLICY', reason: '用户跳过了这份公开论证。' }),
          },
        ]} />
        <FreeInput state={state} dispatch={dispatch} onAskAi={onAskAi} aiLoading={aiLoading} scope="new_root" />
      </>
    );
  }
  return (
    <>
      <QuestionHeader state={state} label="当前判断" title={policy.question} statement={policy.proposition} />
      <ChoiceList options={[
        { id: 'support', label: '支持题设', tone: 'support', onSelect: () => dispatch({ type: 'SET_STANCE', stance: 'support' }) },
        { id: 'oppose', label: '反对题设', tone: 'oppose', onSelect: () => dispatch({ type: 'SET_STANCE', stance: 'oppose' }) },
        { id: 'undecided', label: '暂时没有立场', onSelect: () => dispatch({ type: 'SET_STANCE', stance: 'undecided' }) },
      ]} />
      <FreeInput state={state} dispatch={dispatch} onAskAi={onAskAi} aiLoading={aiLoading} scope="new_root" />
    </>
  );
}

function DirectionQuestion({ state, dispatch, onAskAi, aiLoading }) {
  return (
    <>
      <QuestionHeader state={state} label="选择方向" title="先从哪个方向检查理由？" statement="这不是要求你先承诺结论，只是为下一步选择一条可检查的路径。" />
      <ChoiceList options={[
        { id: 'support', label: '检查支持题设的理由', tone: 'support', onSelect: () => dispatch({ type: 'SET_DIRECTION', direction: 'support' }) },
        { id: 'oppose', label: '检查反对题设的理由', tone: 'oppose', onSelect: () => dispatch({ type: 'SET_DIRECTION', direction: 'oppose' }) },
        { id: 'skip', label: '暂不形成判断', onSelect: () => dispatch({ type: 'SKIP_POLICY' }) },
      ]} />
      <FreeInput state={state} dispatch={dispatch} onAskAi={onAskAi} aiLoading={aiLoading} scope="new_root" />
    </>
  );
}

function ArgumentQuestion({ state, dispatch, onAskAi, aiLoading }) {
  const target = getCurrentTargetClaim(state);
  const allArguments = getArgumentsForClaim(state.currentTargetClaimId);
  const [query, setQuery] = useState('');
  const argumentsForDisplay = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return allArguments;
    return allArguments.filter((argument) => `${argument.title} ${argument.summary}`.toLocaleLowerCase().includes(normalized));
  }, [allArguments, query]);
  return (
    <>
      <QuestionHeader state={state} label="选择理由" title="哪一条最接近你实际采用的理由？" statement={target?.text} />
      {allArguments.length > 6 ? (
        <label className="argument-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索题库理由" /></label>
      ) : null}
      <div className="argument-options" id="question-options">
        {argumentsForDisplay.map((argument) => (
          <button className="argument-row" type="button" key={argument.id} onClick={() => dispatch({ type: 'SELECT_ARGUMENT', argumentId: argument.id })}>
            <span className="argument-copy">
              <strong>{argument.title}</strong>
              <small>{argument.summary}</small>
            </span>
            <ArrowRight size={18} />
          </button>
        ))}
        {!argumentsForDisplay.length ? <p className="empty-state">当前题库没有匹配理由。你可以直接写下自己的想法，让 AI 提出结构化候选。</p> : null}
      </div>
      <FreeInput state={state} dispatch={dispatch} onAskAi={onAskAi} aiLoading={aiLoading} />
    </>
  );
}

function FactQuestion({ state, dispatch, onAskAi, aiLoading }) {
  const fact = getCurrentFact(state);
  const conditional = state.assessmentMode === 'conditional_scenario';
  const stipulated = fact?.evaluationMode === 'scenario_assumption';
  const title = conditional
    ? stipulated ? '这项条件与当前题设一致吗？' : '把这项经验描述作为本轮题设条件吗？'
    : '根据你掌握的现实证据，这个事实成立吗？';
  const options = conditional
    ? stipulated
      ? [
          ['true', '与题设一致', 'support'],
          ['false', '与题设不一致', 'oppose'],
          ['unknown', '暂时无法确认', null],
        ]
      : [
          ['true', '作为题设条件采用', 'support'],
          ['false', '不采用这项题设条件', 'oppose'],
          ['unknown', '暂不采用', null],
        ]
    : [
        ['true', '成立', 'support'],
        ['false', '不成立', 'oppose'],
        ['unknown', '我还不能判断', null],
      ];
  return (
    <>
      <QuestionHeader state={state} label="事实" title={title} statement={fact?.statement} />
      <details className="evidence-details">
        <summary>查看判断说明与条件</summary>
        <div>
          {fact?.plainExplanation ? <p>{fact.plainExplanation}</p> : null}
          <strong>支持条件</strong><p>{fact?.plainTruthConditions || fact?.truthConditions}</p>
          <strong>否定条件</strong><p>{fact?.plainFalsifier || fact?.falsifier}</p>
        </div>
      </details>
      <ChoiceList options={options.map(([id, label, tone]) => ({
        id,
        label,
        tone,
        onSelect: () => dispatch({ type: 'ANSWER_FACT', response: id }),
      }))} />
      <FreeInput state={state} dispatch={dispatch} onAskAi={onAskAi} aiLoading={aiLoading} />
    </>
  );
}

function BridgeQuestion({ state, dispatch, onAskAi, aiLoading }) {
  const bridge = getCurrentBridge(state);
  const target = getCurrentTargetClaim(state);
  return (
    <>
      <QuestionHeader state={state} label="桥接原则" title="你接受这条从事实走向结论所需的原则吗？" statement={bridge?.text} />
      <details className="evidence-details">
        <summary>查看这条原则如何连接结论</summary>
        <div>
          <div className="inference-line"><span>已核对的事实</span><b>＋</b><span>{bridge?.shortLabel || '原则'}</span><b>⇝</b><span>{target?.shortLabel || '结论'}</span></div>
          {bridge?.explanation ? <p>{bridge.explanation}</p> : null}
        </div>
      </details>
      <ChoiceList options={[
        { id: 'accept', label: '接受这条原则', tone: 'support', onSelect: () => dispatch({ type: 'ANSWER_BRIDGE', response: 'accept' }) },
        { id: 'reject', label: '不接受这条原则', tone: 'oppose', onSelect: () => dispatch({ type: 'ANSWER_BRIDGE', response: 'reject' }) },
        { id: 'uncertain', label: '暂时不能判断', onSelect: () => dispatch({ type: 'ANSWER_BRIDGE', response: 'uncertain' }) },
      ]} />
      <FreeInput state={state} dispatch={dispatch} onAskAi={onAskAi} aiLoading={aiLoading} />
    </>
  );
}

function DepthQuestion({ state, dispatch }) {
  const bridge = claims[state.currentChain?.steps.at(-1)?.bridgeClaimId];
  const canNominate = canNominateClaim(bridge);
  return (
    <>
      <QuestionHeader state={state} label="继续追问" title="这条原则还需要更深的规范理由吗？" statement={bridge?.text} />
      <ChoiceList options={[
        {
          id: 'fixed',
          label: canNominate ? '它可以作为本轮当前基本价值候选' : '这条原则还没有结构化反例测试，不能在这里停止',
          disabled: !canNominate,
          onSelect: () => dispatch({ type: 'SET_DEPTH', decision: 'fixed_point' }),
        },
        { id: 'deeper', label: '继续追问为什么', onSelect: () => dispatch({ type: 'SET_DEPTH', decision: 'deeper' }) },
        { id: 'uncertain', label: '暂时无法判断', onSelect: () => dispatch({ type: 'SET_DEPTH', decision: 'uncertain' }) },
      ]} />
    </>
  );
}

function TerminalQuestion({ state, dispatch }) {
  const claimId = state.currentChain?.terminal?.claimId || state.currentChain?.steps.at(-1)?.bridgeClaimId;
  const claim = claims[claimId];
  return (
    <>
      <QuestionHeader state={state} label="独立确认" title="即使暂时不给出更深理由，你现在仍直接接受它吗？" statement={claim?.text} />
      <p className="explanation-line">这不是客观公理声明，只记录本轮追问暂时停在哪里。</p>
      <ChoiceList options={[
        { id: 'accept', label: '是，我现在直接接受它', onSelect: () => dispatch({ type: 'CONFIRM_TERMINAL', response: 'accept' }) },
        { id: 'continue', label: '不是，继续追问更深理由', onSelect: () => dispatch({ type: 'CONFIRM_TERMINAL', response: 'continue' }) },
        { id: 'reject', label: '我不愿把它作为当前基本价值', onSelect: () => dispatch({ type: 'CONFIRM_TERMINAL', response: 'reject' }) },
        { id: 'uncertain', label: '暂时不能确认', onSelect: () => dispatch({ type: 'CONFIRM_TERMINAL', response: 'uncertain' }) },
      ]} />
    </>
  );
}

function StressQuestion({ state, dispatch }) {
  const claim = claims[state.currentChain?.terminal?.claimId];
  const stress = claim?.stressTest || {};
  const [distinctionOpen, setDistinctionOpen] = useState(false);
  const [distinction, setDistinction] = useState('');
  return (
    <>
      <QuestionHeader state={state} label="相似案例检验" title={stress.question || '换一个政治对象后，你仍接受这条原则吗？'} statement={stress.scenario || claim?.example} />
      {stress.distinctions?.length ? <ul className="distinction-list">{stress.distinctions.map((item) => <li key={item}>{item}</li>)}</ul> : null}
      <ChoiceList options={[
        { id: 'apply', label: '仍然适用', onSelect: () => dispatch({ type: 'ANSWER_STRESS', response: 'apply' }) },
        { id: 'qualified', label: '有一个相关区别需要写清楚（将记录为仍有张力）', onSelect: () => setDistinctionOpen(true) },
        { id: 'unexplained', label: '只在原案例适用，但我说不清区别', onSelect: () => dispatch({ type: 'ANSWER_STRESS', response: 'unexplained_exception' }) },
        { id: 'retract', label: '我撤回这条原则', onSelect: () => dispatch({ type: 'ANSWER_STRESS', response: 'retract' }) },
        { id: 'uncertain', label: '暂时无法判断', onSelect: () => dispatch({ type: 'ANSWER_STRESS', response: 'uncertain' }) },
      ]} />
      {distinctionOpen ? (
        <div className="inline-form">
          <label htmlFor="stress-distinction">相关区别</label>
          <textarea id="stress-distinction" rows={3} value={distinction} onChange={(event) => setDistinction(event.target.value)} />
          <button className="button primary" type="button" disabled={!distinction.trim()} onClick={() => dispatch({ type: 'ANSWER_STRESS', response: 'qualified_exception', distinction: distinction.trim() })}>确认区别并继续</button>
        </div>
      ) : null}
    </>
  );
}

function ConflictQuestion({ state, dispatch }) {
  const conflict = state.pendingConflict;
  const text = conflict?.kind === 'fact'
    ? facts[conflict.propositionId]?.statement
    : claims[conflict?.propositionId]?.text;
  return (
    <>
      <QuestionHeader state={state} label="回答冲突" title="你对同一句话给过相反回答。" statement={text} />
      <ChoiceList options={[
        { id: 'revise', label: '用当前回答修订之前的回答', onSelect: () => dispatch({ type: 'RESOLVE_CONFLICT', resolution: 'revise_prior' }) },
        { id: 'keep', label: '保留之前的回答，撤回当前回答', onSelect: () => dispatch({ type: 'RESOLVE_CONFLICT', resolution: 'keep_prior' }) },
        { id: 'suspend', label: '把这句话暂时设为不能判断', onSelect: () => dispatch({ type: 'RESOLVE_CONFLICT', resolution: 'suspend' }) },
        { id: 'scope', label: '两个情境的范围其实不同', onSelect: () => dispatch({ type: 'RESOLVE_CONFLICT', resolution: 'scope_gap' }) },
      ]} />
    </>
  );
}

function BrokenQuestion({ state, dispatch }) {
  return (
    <>
      <QuestionHeader state={state} label="论证中断" title="当前这条理由还不能走完整。" statement={state.breakReason} />
      <ChoiceList options={[
        { id: 'alternate', label: '换一条理由继续', onSelect: () => dispatch({ type: 'RESOLVE_BREAK', resolution: 'alternate_argument' }) },
        { id: 'stance', label: '重新判断当前立场', onSelect: () => dispatch({ type: 'RESOLVE_BREAK', resolution: 'revise_stance' }) },
        { id: 'stop', label: '保留为未解决并结束这项政策', onSelect: () => dispatch({ type: 'RESOLVE_BREAK', resolution: 'finalize' }) },
      ]} />
    </>
  );
}

function PolicyComplete({ state, dispatch }) {
  const policy = getCurrentPolicy(state);
  const status = state.currentChain?.status || 'unresolved';
  const conditionalScenario = state.currentChain?.steps?.some((step) => step.assessmentMode === 'conditional_scenario');
  const copy = {
    complete: ['这条单一理由链已经闭合', '事实、原则、当前基本价值和压力测试都已确认；这不表示政策结论已经压倒全部反对理由。'],
    conditional: conditionalScenario
      ? ['这条理由链只在题设条件下闭合', '规范结构已经记录，但经验前提没有在现实中得到确认，不能进入公开候选区。']
      : ['这条论证依赖尚未确认的事实', '结构已经记录，但不能进入公开候选区。'],
    tension: ['这条论证仍有适用范围张力', '结构已经记录，但需要先说明例外或区别。'],
    unresolved: ['这条论证仍未解决', '未完成内容继续只保存在本地。'],
  }[status];
  return (
    <section className="completion-screen">
      <span className={`completion-icon ${status}`}>{status === 'complete' ? <Check /> : <CircleHelp />}</span>
      <h1>{copy[0]}</h1>
      <p>{copy[1]}</p>
      <strong>{policy?.title}</strong>
      <div className="completion-actions">
        <button className="button primary" type="button" onClick={() => dispatch({ type: 'OPEN_OVERVIEW' })}>返回题目列表</button>
        <button className="button secondary" type="button" onClick={() => dispatch({ type: 'SHOW_RESULTS' })}>查看阶段结果</button>
        <button className="button quiet" type="button" onClick={() => dispatch({ type: 'RETRY_POLICY' })}>为这项判断换一条理由</button>
      </div>
    </section>
  );
}

function DilemmaIntro({ state, dispatch }) {
  const commitments = collectTerminalCommitments(state);
  const uniqueCommitments = [...new Map(commitments.map((item) => [item.claimId, item])).values()];
  return (
    <section className="completion-screen">
      <span className="completion-icon complete"><Check /></span>
      <h1>已确认 {uniqueCommitments.length} 项当前基本价值</h1>
      {commitments.length !== uniqueCommitments.length ? <p>这些价值来自 {commitments.length} 条已结束的理由链。</p> : null}
      <p>接下来只比较题库中同时涉及两项已确认价值的具体冲突；也可以直接查看阶段结果。</p>
      <div className="completion-actions">
        <button className="button primary" type="button" onClick={() => dispatch({ type: 'START_DILEMMAS' })}>开始具体冲突检验</button>
        <button className="button secondary" type="button" onClick={() => dispatch({ type: 'SHOW_RESULTS' })}>直接查看阶段结果</button>
      </div>
    </section>
  );
}

function DilemmaQuestion({ state, dispatch }) {
  const id = state.dilemmaQueue[state.dilemmaIndex];
  const item = dilemmas.find((entry) => entry.id === id);
  if (!item) return null;
  const left = claims[item.left];
  const right = claims[item.right];
  return (
    <>
      <QuestionHeader state={state} label={`冲突检验 ${state.dilemmaIndex + 1} / ${state.dilemmaQueue.length}`} title={item.title} statement={item.scenario} />
      <ul className="fixed-facts">{item.fixedFacts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
      <div className="dilemma-comparison">
        <div><span>A · {left?.shortLabel}</span><p>{item.leftAction}</p></div>
        <div><span>B · {right?.shortLabel}</span><p>{item.rightAction}</p></div>
      </div>
      <ChoiceList options={[
        { id: 'left-strong', label: '明显选择 A', onSelect: () => dispatch({ type: 'ANSWER_DILEMMA', response: 'left_strong' }) },
        { id: 'left-slight', label: '略微选择 A', onSelect: () => dispatch({ type: 'ANSWER_DILEMMA', response: 'left_slight' }) },
        { id: 'equal', label: 'A 与 B 同等重要', onSelect: () => dispatch({ type: 'ANSWER_DILEMMA', response: 'equal' }) },
        { id: 'undecided', label: '本题无法比较', onSelect: () => dispatch({ type: 'ANSWER_DILEMMA', response: 'undecided' }) },
        { id: 'right-slight', label: '略微选择 B', onSelect: () => dispatch({ type: 'ANSWER_DILEMMA', response: 'right_slight' }) },
        { id: 'right-strong', label: '明显选择 B', onSelect: () => dispatch({ type: 'ANSWER_DILEMMA', response: 'right_strong' }) },
      ]} />
    </>
  );
}

const recordStatusCopy = {
  complete: '已完整结束',
  conditional: '已结束，有条件',
  tension: '已结束，有张力',
  unresolved: '已结束，未解决',
};

function AssessmentModeSelector({ state, dispatch }) {
  const modes = Object.entries(assessmentModes).filter(([, value]) => value && typeof value === 'object');
  const current = assessmentModes[state.assessmentMode];
  const locked = Object.keys(state.records).length > 0;
  return (
    <fieldset className="assessment-mode" disabled={locked}>
      <legend>事实回答方式</legend>
      <div className="assessment-mode-options">
        {modes.map(([id, mode]) => (
          <label key={id}>
            <input
              type="radio"
              name="assessment-mode"
              value={id}
              checked={state.assessmentMode === id}
              onChange={() => dispatch({ type: 'SET_ASSESSMENT_MODE', mode: id })}
            />
            <span>{mode.label}</span>
          </label>
        ))}
      </div>
      <p>{current?.instruction}{locked ? ' 本轮已有答题进度，回答方式已锁定。' : ''}</p>
    </fieldset>
  );
}

function PolicyOverview({ state, dispatch }) {
  const finished = policies.filter((policy) => state.records[policy.id]?.chains?.length).length;
  const inProgress = policies.filter((policy) => state.records[policy.id]?.draft).length;
  const commitments = collectTerminalCommitments(state);
  const canStartDilemmas = getRelevantDilemmas(commitments.map((item) => item.claimId)).length > 0;
  const canResumeDilemmas = Boolean(state.dilemmaQueue[state.dilemmaIndex]);
  return (
    <main className="policy-overview">
      <header className="overview-header">
        <div>
          <span>题目列表</span>
          <h1>按自己的顺序做题</h1>
          <p>随时离开，进度会保存在这台设备。阶段结果只统计已经结束的题目。</p>
        </div>
        <div className="overview-actions">
          {finished ? <button className="button secondary" type="button" onClick={() => dispatch({ type: 'SHOW_RESULTS' })}><BarChart3 size={17} />查看阶段结果</button> : null}
          <button className="button quiet" type="button" onClick={() => dispatch({ type: 'EXIT_TO_LANDING' })}><LogOut size={17} />退出</button>
        </div>
      </header>

      <AssessmentModeSelector state={state} dispatch={dispatch} />

      <div className="overview-progress" aria-label="答题进度">
        <strong>{finished} / {policies.length}</strong>
        <span>道题已结束{inProgress ? ` · ${inProgress} 道进行中` : ''}</span>
      </div>

      <ol className="policy-list">
        {policies.map((policy, index) => {
          const record = state.records[policy.id];
          const hasDraft = Boolean(record?.draft);
          const hasChains = Boolean(record?.chains?.length);
          const direction = record?.draft?.currentChain?.direction || record?.direction || record?.stance;
          const tone = direction === 'support' || direction === 'oppose' ? direction : 'neutral';
          const actionLabel = hasDraft ? '继续' : hasChains ? '再做一次' : '开始';
          const status = hasDraft ? '进行中' : hasChains ? record.mixed ? '已结束，状态混合' : recordStatusCopy[record.status] || '已结束' : '未开始';
          const statusClass = hasDraft ? 'active' : hasChains ? record.status : 'not-started';
          return (
            <li className="policy-row" data-policy-id={policy.id} key={policy.id}>
              <span className="policy-number">{String(index + 1).padStart(2, '0')}</span>
              <div className="policy-row-title">
                <h2>{policy.shortTitle || policy.title}</h2>
                {direction ? <span className={`direction-badge ${tone}`}>{directionCopy[direction]}</span> : null}
              </div>
              <span className={`policy-status ${statusClass}`}>{status}</span>
              <button className={`button ${hasDraft ? 'primary' : 'quiet'}`} type="button" aria-label={`${actionLabel}：${policy.shortTitle || policy.title}`} onClick={() => dispatch({ type: 'OPEN_POLICY', policyId: policy.id })}>
                {actionLabel}<ArrowRight size={17} />
              </button>
            </li>
          );
        })}
      </ol>

      {canResumeDilemmas || canStartDilemmas ? (
        <div className="dilemma-entry">
          <div><strong>价值冲突检验</strong><p>只比较你已经确认的价值，不影响题目完成状态。</p></div>
          <button className="button quiet" type="button" onClick={() => dispatch({ type: canResumeDilemmas ? 'RESUME_DILEMMAS' : 'START_DILEMMAS' })}>
            {canResumeDilemmas ? '继续检验' : '开始检验'}<ArrowRight size={17} />
          </button>
        </div>
      ) : null}
    </main>
  );
}

function PhaseQuestion({ state, dispatch, onAskAi, aiLoading }) {
  const props = { state, dispatch, onAskAi, aiLoading };
  switch (state.phase) {
    case PHASES.STANCE: return <StanceQuestion {...props} />;
    case PHASES.DIRECTION: return <DirectionQuestion {...props} />;
    case PHASES.ARGUMENT: return <ArgumentQuestion {...props} />;
    case PHASES.FACT: return <FactQuestion {...props} />;
    case PHASES.BRIDGE: return <BridgeQuestion {...props} />;
    case PHASES.DEPTH: return <DepthQuestion {...props} />;
    case PHASES.TERMINAL_CONFIRM: return <TerminalQuestion {...props} />;
    case PHASES.STRESS: return <StressQuestion {...props} />;
    case PHASES.CONFLICT: return <ConflictQuestion {...props} />;
    case PHASES.BROKEN: return <BrokenQuestion {...props} />;
    case PHASES.POLICY_COMPLETE: return <PolicyComplete state={state} dispatch={dispatch} />;
    case PHASES.DILEMMA_INTRO: return <DilemmaIntro state={state} dispatch={dispatch} />;
    case PHASES.DILEMMA: return <DilemmaQuestion state={state} dispatch={dispatch} />;
    default: return <div className="empty-state"><AlertTriangle />当前步骤无法显示。</div>;
  }
}

export default function Assessment({ state, dispatch, onAskAi, aiLoading }) {
  if (state.phase === PHASES.POLICY_OVERVIEW) return <PolicyOverview state={state} dispatch={dispatch} />;
  const hasResults = Object.values(state.records).some((record) => record.chains?.length);
  return (
    <main className="workspace">
      <nav className="workspace-toolbar" aria-label="答题导航">
        <button className="button quiet" type="button" onClick={() => dispatch({ type: 'OPEN_OVERVIEW' })}><ListChecks size={17} />题目列表</button>
        <button className="button quiet" type="button" disabled={!hasResults} onClick={() => dispatch({ type: 'SHOW_RESULTS' })}><BarChart3 size={17} />阶段结果</button>
        <button className="button quiet" type="button" onClick={() => dispatch({ type: 'EXIT_TO_LANDING' })}><LogOut size={17} />退出</button>
      </nav>
      <StageRail phase={state.phase} />
      <section className="question-surface">
        <PhaseQuestion state={state} dispatch={dispatch} onAskAi={onAskAi} aiLoading={aiLoading} />
      </section>
      <ProofView state={state} />
    </main>
  );
}
