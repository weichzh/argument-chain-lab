import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CircleHelp,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  claims,
  dilemmas,
  facts,
  getArgumentsForClaim,
  policies,
} from '../data/model.js';
import { sessionDraftKey } from '../hooks/useSession.js';
import {
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
    <aside className="stage-rail" aria-label="论证阶段">
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
        <button key={option.id} className="choice-row" type="button" onClick={option.onSelect} disabled={option.disabled}>
          <span className="choice-radio" aria-hidden="true" />
          <span><strong>{option.label}</strong>{option.detail ? <small>{option.detail}</small> : null}</span>
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

  useEffect(() => {
    try {
      setDraft(window.sessionStorage.getItem(key) || '');
    } catch {
      setDraft('');
    }
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
    <section className="free-input" id="free-input">
      <label htmlFor={key}>这些都不符合我的想法</label>
      <textarea
        id={key}
        rows={3}
        value={draft}
        onChange={(event) => update(event.target.value)}
        placeholder="写下你的判断、理由或需要补充的条件…"
      />
      <div className="free-input-actions">
        <p>只有选择 AI 梳理时才会发送内容；记录题库缺口不会保存这段原文。</p>
        <button
          className="button quiet"
          type="button"
          onClick={() => {
            update('');
            dispatch({ type: 'NO_ARGUMENT' });
          }}
        >
          记录题库缺口并结束这项判断
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
      <div className="question-context">
        <strong>{progress}</strong>
        <span>{policy?.shortTitle || policy?.title}</span>
      </div>
      <header className="question-heading">
        <h1>{title}</h1>
        {statement ? <p>{statement}</p> : null}
      </header>
    </>
  );
}

function SourceSwitch() {
  return (
    <div className="source-switch" aria-label="问题来源">
      <span>问题来源</span>
      <a className="active" href="#question-options">正式题库</a>
      <a href="#free-input"><Bot size={15} />AI 生成</a>
    </div>
  );
}

function StanceQuestion({ state, dispatch, onAskAi, aiLoading }) {
  const policy = getCurrentPolicy(state);
  if (policy?.origin === 'community') {
    return (
      <>
        <QuestionHeader state={state} label="公开论证" title="沿着这份公开论证开始核对吗？" statement={policy.proposition} />
        <p className="scope-note">{policy.scope}</p>
        <ChoiceList options={[
          {
            id: 'direct',
            label: '开始逐项核对这份论证',
            detail: '你仍需重新判断其中每项事实、原则与价值。',
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
      <p className="scope-note">{policy.scope}</p>
      <ChoiceList options={[
        { id: 'support', label: '支持', detail: '继续检查支持这项政策的实际理由。', onSelect: () => dispatch({ type: 'SET_STANCE', stance: 'support' }) },
        { id: 'oppose', label: '反对', detail: '继续检查反对这项政策的实际理由。', onSelect: () => dispatch({ type: 'SET_STANCE', stance: 'oppose' }) },
        { id: 'undecided', label: '暂时没有立场', detail: '可以先选择一个方向，检查什么理由会使它成立。', onSelect: () => dispatch({ type: 'SET_STANCE', stance: 'undecided' }) },
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
        { id: 'support', label: '什么理由会支持它', onSelect: () => dispatch({ type: 'SET_DIRECTION', direction: 'support' }) },
        { id: 'oppose', label: '什么理由会反对它', onSelect: () => dispatch({ type: 'SET_DIRECTION', direction: 'oppose' }) },
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
      <SourceSwitch />
      {allArguments.length > 6 ? (
        <label className="argument-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索题库理由" /></label>
      ) : null}
      <div className="argument-options" id="question-options">
        {argumentsForDisplay.map((argument) => (
          <button className="argument-row" type="button" key={argument.id} onClick={() => dispatch({ type: 'SELECT_ARGUMENT', argumentId: argument.id })}>
            <span className="origin-mark">{argument.origin === 'session_overlay' ? '会话扩展' : argument.origin === 'community' ? '公开贡献' : '正式题库'}</span>
            <span><strong>{argument.title}</strong><small>{argument.summary}</small></span>
            <span className="argument-anatomy">{argument.factIds.length}F + B ⇝ V</span>
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
  return (
    <>
      <QuestionHeader state={state} label="事实" title="你认为这个事实成立吗？" statement={fact?.statement} />
      <SourceSwitch />
      {fact?.plainExplanation ? <p className="explanation-line">{fact.plainExplanation}</p> : null}
      <details className="evidence-details">
        <summary>查看支持或否定这句话的条件</summary>
        <div><strong>支持条件</strong><p>{fact?.plainTruthConditions || fact?.truthConditions}</p><strong>否定条件</strong><p>{fact?.plainFalsifier || fact?.falsifier}</p></div>
      </details>
      <ChoiceList options={[
        { id: 'true', label: '成立', onSelect: () => dispatch({ type: 'ANSWER_FACT', response: 'true' }) },
        { id: 'false', label: '不成立', onSelect: () => dispatch({ type: 'ANSWER_FACT', response: 'false' }) },
        { id: 'unknown', label: '我还不能判断', detail: '缺少足够信息，不等于第三种真值。', onSelect: () => dispatch({ type: 'ANSWER_FACT', response: 'unknown' }) },
      ]} />
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
      <div className="inference-line"><span>已核对的 F</span><b>＋</b><span>{bridge?.shortLabel || 'B'}</span><b>⇝</b><span>{target?.shortLabel || 'V'}</span></div>
      {bridge?.explanation ? <p className="explanation-line">{bridge.explanation}</p> : null}
      <ChoiceList options={[
        { id: 'accept', label: '接受这条原则', onSelect: () => dispatch({ type: 'ANSWER_BRIDGE', response: 'accept' }) },
        { id: 'reject', label: '不接受这条原则', onSelect: () => dispatch({ type: 'ANSWER_BRIDGE', response: 'reject' }) },
        { id: 'uncertain', label: '暂时不能判断', onSelect: () => dispatch({ type: 'ANSWER_BRIDGE', response: 'uncertain' }) },
      ]} />
      <FreeInput state={state} dispatch={dispatch} onAskAi={onAskAi} aiLoading={aiLoading} />
    </>
  );
}

function DepthQuestion({ state, dispatch }) {
  const bridge = claims[state.currentChain?.steps.at(-1)?.bridgeClaimId];
  const deeperCount = getArgumentsForClaim(bridge?.id).length;
  return (
    <>
      <QuestionHeader state={state} label="继续追问" title="这条原则还需要更深的规范理由吗？" statement={bridge?.text} />
      <ChoiceList options={[
        { id: 'fixed', label: '它可以作为本轮当前基本价值候选', detail: '下一步仍会独立确认并做相似案例检验。', onSelect: () => dispatch({ type: 'SET_DEPTH', decision: 'fixed_point' }) },
        { id: 'deeper', label: '继续追问为什么', detail: deeperCount ? `题库还有 ${deeperCount} 条可检查理由。` : '题库没有现成理由，可继续让 AI 梳理。', onSelect: () => dispatch({ type: 'SET_DEPTH', decision: 'deeper' }) },
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
        { id: 'qualified', label: '有一个相关区别需要写清楚', onSelect: () => setDistinctionOpen(true) },
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
        { id: 'scope', label: '两个情境的范围其实不同', detail: '保留差异，并把缺少的条件记录为未解决张力。', onSelect: () => dispatch({ type: 'RESOLVE_CONFLICT', resolution: 'scope_gap' }) },
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
  const copy = {
    complete: ['这条论证已经完整', '事实、原则、当前基本价值和压力测试都已确认。'],
    conditional: ['这条论证依赖尚未确认的事实', '结构已经记录，但不能进入公开候选区。'],
    tension: ['这条论证仍有适用范围张力', '结构已经记录，但需要先说明例外或区别。'],
    unresolved: ['这条论证仍未解决', '未完成内容继续只保存在本地。'],
  }[status];
  const lastPolicy = state.policyIndex >= policies.length - 1;
  return (
    <section className="completion-screen">
      <span className={`completion-icon ${status}`}>{status === 'complete' ? <Check /> : <CircleHelp />}</span>
      <h1>{copy[0]}</h1>
      <p>{copy[1]}</p>
      <strong>{policy?.title}</strong>
      <div className="completion-actions">
        <button className="button primary" type="button" onClick={() => dispatch({ type: 'SHOW_RESULTS' })}>查看完整预览</button>
        {!lastPolicy ? <button className="button secondary" type="button" onClick={() => dispatch({ type: 'NEXT_POLICY' })}>继续下一项题库判断</button> : <button className="button secondary" type="button" onClick={() => dispatch({ type: 'START_DILEMMAS' })}>继续价值冲突检验</button>}
        <button className="button quiet" type="button" onClick={() => dispatch({ type: 'RETRY_POLICY' })}>为这项判断换一条理由</button>
      </div>
    </section>
  );
}

function DilemmaIntro({ state, dispatch }) {
  const commitments = collectTerminalCommitments(state);
  return (
    <section className="completion-screen">
      <span className="completion-icon complete"><Check /></span>
      <h1>已确认 {commitments.length} 项当前基本价值</h1>
      <p>接下来只比较题库中同时涉及两项已确认价值的具体冲突；也可以直接查看完整预览。</p>
      <div className="completion-actions">
        <button className="button primary" type="button" onClick={() => dispatch({ type: 'START_DILEMMAS' })}>开始具体冲突检验</button>
        <button className="button secondary" type="button" onClick={() => dispatch({ type: 'SHOW_RESULTS' })}>直接查看完整预览</button>
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
        { id: 'undecided', label: '本题无法比较', onSelect: () => dispatch({ type: 'ANSWER_DILEMMA', response: 'undecided' }) },
        { id: 'right-slight', label: '略微选择 B', onSelect: () => dispatch({ type: 'ANSWER_DILEMMA', response: 'right_slight' }) },
        { id: 'right-strong', label: '明显选择 B', onSelect: () => dispatch({ type: 'ANSWER_DILEMMA', response: 'right_strong' }) },
      ]} />
    </>
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
  return (
    <main className="workspace">
      <StageRail phase={state.phase} />
      <section className="question-surface">
        <PhaseQuestion state={state} dispatch={dispatch} onAskAi={onAskAi} aiLoading={aiLoading} />
      </section>
      <ProofView state={state} />
    </main>
  );
}
