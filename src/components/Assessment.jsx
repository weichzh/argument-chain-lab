import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  CircleHelp,
  House,
  ListChecks,
  Search,
  SkipForward,
  Sparkles,
} from 'lucide-react';
import {
  argumentsById,
  claims,
  dilemmas,
  facts,
  getArgumentsForClaim,
  getPolicyElements,
  policies,
} from '../data/model.js';
import { sessionDraftKey } from '../hooks/useSession.js';
import {
  canNominateClaim,
  collectTerminalCommitments,
  getConditionalFollowUps,
  getCurrentArgument,
  getCurrentBridge,
  getCurrentFact,
  getCurrentPolicy,
  getCurrentTargetClaim,
  getSelectedChain,
  PHASES,
} from '../lib/engine.js';
import ProofView from './ProofView.jsx';

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
  const [gapSummary, setGapSummary] = useState('');

  useEffect(() => {
    try {
      setDraft(window.sessionStorage.getItem(key) || '');
    } catch {
      setDraft('');
    }
    setSaveGapSummary(false);
    setGapSummary('');
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
              <span>另存一段可编辑的题库缺口摘要</span>
            </label>
          ) : null}
          {saveGapSummary ? (
            <label className="field" htmlFor={`${key}-gap-summary`}>
              <span>缺口摘要（会保存到本地和导出中）</span>
              <textarea id={`${key}-gap-summary`} rows={2} maxLength={400} value={gapSummary} onChange={(event) => setGapSummary(event.target.value)} placeholder="只写题库缺少了哪一种理由或条件，不必重复原文。" />
            </label>
          ) : null}
          <button
            className="button quiet"
            type="button"
            onClick={() => {
              const summary = saveGapSummary ? gapSummary.trim() : null;
              update('');
              setSaveGapSummary(false);
              setGapSummary('');
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
  support: '支持',
  oppose: '反对',
  conditional: '只在某些条件下支持',
  undecided: '暂时不能判断',
};

function QuestionHeader({ state, label, title, statement }) {
  const policy = getCurrentPolicy(state);
  const argument = getCurrentArgument(state);
  const progress = state.phase === PHASES.FACT && argument
    ? `假设 ${state.currentFactIndex + 1} / ${argument.factIds.length}`
    : label;
  return (
    <>
      <div className="question-context">
        <strong>{policy?.shortTitle || policy?.title || progress}</strong>
        {state.phase === PHASES.FACT && argument ? <span>{progress}</span> : null}
      </div>
      <header className="question-heading">
        <h1>{title}</h1>
        {statement ? <p>{statement}</p> : null}
      </header>
    </>
  );
}

const componentPositionCopy = {
  support: '赞成',
  oppose: '反对',
  conditional: '需调整',
  undecided: '无独立判断',
};

const elementResponseOptions = {
  policy_choice: Object.entries(componentPositionCopy),
  safeguard: [
    ['required', '必须有'],
    ['preferred', '最好有'],
    ['not_required', '不需要'],
    ['uncertain', '未判断'],
  ],
  parameter: [
    ['accept', '接受'],
    ['adjust', '需调整'],
    ['reject', '不接受'],
    ['uncertain', '未判断'],
  ],
};

const elementResponseField = {
  policy_choice: 'policyChoiceResponses',
  safeguard: 'safeguardResponses',
  parameter: 'parameterResponses',
};

const elementGroupLabel = {
  policy_choice: '政策选择',
  safeguard: '保障条件',
  parameter: '参数设置',
};

const simpleElementOptions = {
  policy_choice: [
    ['support', '可以接受'],
    ['conditional', '需要调整后才可以接受'],
    ['oppose', '不能接受'],
    ['undecided', '暂时不能判断'],
  ],
  safeguard: [
    ['required', '必须保留'],
    ['preferred', '最好保留'],
    ['not_required', '不需要'],
    ['uncertain', '暂时不能判断'],
  ],
  parameter: [
    ['accept', '可以接受'],
    ['adjust', '需要调整'],
    ['reject', '不能接受'],
    ['uncertain', '暂时不能判断'],
  ],
};

function SimpleComponentQuestion({ state, dispatch }) {
  const policy = getCurrentPolicy(state);
  const followUps = getConditionalFollowUps(policy);
  const element = followUps[state.currentElementIndex];
  if (!element) return null;
  const options = element.simpleOptions?.map(({ value, label }) => [value, label])
    || simpleElementOptions[element.kind]
    || [];
  const title = element.label.endsWith('？')
    ? element.label
    : `关于“${element.label}”，你的判断是？`;
  return (
    <>
      <QuestionHeader
        state={state}
        label={`补充问题 ${state.currentElementIndex + 1} / ${followUps.length}`}
        title={title}
        statement={element.simpleOptions ? null : element.plainExplanation}
      />
      <ChoiceList options={options.map(([response, label]) => ({
        id: response,
        label,
        onSelect: () => dispatch({ type: 'ANSWER_SIMPLE_ELEMENT', response }),
      }))} />
    </>
  );
}

function ComponentQuestion({ state, dispatch }) {
  const policy = getCurrentPolicy(state);
  const record = state.records[policy.id] || {};
  const elements = getPolicyElements(policy, ['policy_choice', 'safeguard', 'parameter']);
  const responseFor = (element) => record[elementResponseField[element.kind]]?.[element.id];
  const complete = elements.every(responseFor);
  return (
    <>
      <QuestionHeader state={state} label="政策拆分" title="先分别判断这项政策里的决定" statement="固定情景不要求赞成或反对；其余回答也不会自动合并成整包立场。" />
      <div className="component-question-list">
        {elements.map((element) => {
          const response = responseFor(element);
          const needsNote = ['conditional', 'undecided', 'adjust', 'uncertain'].includes(response);
          return (
          <fieldset className="component-question" key={element.id}>
            <legend><span>{elementGroupLabel[element.kind]}</span>{element.label}</legend>
            <p>{element.plainExplanation}</p>
            <small>{element.whyItMatters}</small>
            <div className="segmented-control">
              {elementResponseOptions[element.kind].map(([position, label]) => (
                <button
                  type="button"
                  key={position}
                  className={response === position ? 'active' : ''}
                  aria-pressed={response === position}
                  onClick={() => dispatch({ type: 'SET_POLICY_ELEMENT_RESPONSE', elementId: element.id, response: position })}
                >
                  {label}
                </button>
              ))}
            </div>
            {needsNote ? <label className="element-note"><span>补充条件或未判断原因（可选）</span><textarea rows={2} maxLength={400} value={record.elementNotes?.[element.id] || ''} onChange={(event) => dispatch({ type: 'SET_POLICY_ELEMENT_NOTE', elementId: element.id, note: event.target.value })} /></label> : null}
          </fieldset>
          );
        })}
      </div>
      <div className="component-actions">
        {!complete ? (
          <button
            className="button quiet"
            type="button"
            onClick={() => {
              elements.filter((element) => !responseFor(element)).forEach((element) => {
                dispatch({
                  type: 'SET_POLICY_ELEMENT_RESPONSE',
                  elementId: element.id,
                  response: element.kind === 'policy_choice' ? 'undecided' : 'uncertain',
                });
              });
              dispatch({ type: 'COMPLETE_COMPONENTS' });
            }}
          >
            其余项目暂不判断
          </button>
        ) : null}
        <button className="button primary" type="button" disabled={!complete} onClick={() => dispatch({ type: 'COMPLETE_COMPONENTS' })}>
          判断整个政策包<ArrowRight size={17} />
        </button>
      </div>
    </>
  );
}

function PackageTradeoffQuestion({ state, dispatch }) {
  const policy = getCurrentPolicy(state);
  const record = state.records[policy.id] || {};
  const tradeoffs = record.componentTradeoffs || {};
  const choices = getPolicyElements(policy, ['policy_choice']);
  const values = Object.values(tradeoffs);
  const ready = values.includes('required') && values.includes('tradeable');
  return (
    <>
      <QuestionHeader state={state} label="包内取舍" title="哪些政策选择是底线，哪些可以交换？" statement="你的整包判断与独立选择不完全一致；这里保留实际取舍，不强行归并。" />
      <div className="component-question-list compact">
        {choices.map((component) => (
          <fieldset className="component-question" key={component.id}>
            <legend><span>{componentPositionCopy[record.policyChoiceResponses?.[component.id]]}</span>{component.label}</legend>
            <div className="segmented-control three">
              {[
                ['required', '必须保留'],
                ['tradeable', '可为其他选择让步'],
                ['neutral', '不参与交换'],
              ].map(([position, label]) => (
                <button
                  type="button"
                  key={position}
                  className={tradeoffs[component.id] === position ? 'active' : ''}
                  aria-pressed={tradeoffs[component.id] === position}
                  onClick={() => dispatch({ type: 'SET_COMPONENT_TRADEOFF', componentId: component.id, position })}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="component-actions">
        <button className="button quiet" type="button" onClick={() => dispatch({ type: 'COMPLETE_PACKAGE_TRADEOFF', mode: 'none' })}>没有可接受的选择交换</button>
        <button className="button primary" type="button" disabled={!ready} onClick={() => dispatch({ type: 'COMPLETE_PACKAGE_TRADEOFF', mode: 'specified' })}>
          记录取舍并检查理由<ArrowRight size={17} />
        </button>
      </div>
    </>
  );
}

function StanceQuestion({ state, dispatch }) {
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
            label: '跳过这题',
            onSelect: () => dispatch({ type: state.simpleFlow ? 'SKIP_SIMPLE_POLICY' : 'SKIP_POLICY' }),
          },
        ]} />
      </>
    );
  }
  const labels = {
    support: '支持这项政策',
    oppose: '不支持这项政策',
    conditional: '只在某些条件下支持',
    undecided: '暂时不能判断',
    ...policy?.stanceOptions,
  };
  return (
    <>
      <QuestionHeader state={state} label="当前判断" title={policy.question} statement={policy.proposition} />
      <ChoiceList options={[
        { id: 'support', label: labels.support, tone: 'support', onSelect: () => dispatch({ type: 'SET_SIMPLE_STANCE', stance: 'support' }) },
        { id: 'oppose', label: labels.oppose, tone: 'oppose', onSelect: () => dispatch({ type: 'SET_SIMPLE_STANCE', stance: 'oppose' }) },
        { id: 'conditional', label: labels.conditional, onSelect: () => dispatch({ type: 'SET_SIMPLE_STANCE', stance: 'conditional' }) },
        { id: 'undecided', label: labels.undecided, onSelect: () => dispatch({ type: 'SET_SIMPLE_STANCE', stance: 'undecided' }) },
      ]} />
      {state.simpleFlow ? (
        <div className="stance-actions">
          <button className="button quiet" type="button" onClick={() => dispatch({ type: 'SKIP_SIMPLE_POLICY' })}>
            <SkipForward size={17} />跳过这题
          </button>
        </div>
      ) : null}
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
  const policy = getCurrentPolicy(state);
  const stance = state.records[policy?.id]?.stance || state.currentChain?.direction;
  const allArguments = getArgumentsForClaim(state.currentTargetClaimId);
  const [query, setQuery] = useState('');
  const argumentsForDisplay = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return allArguments;
    return allArguments.filter((argument) => `${argument.title} ${argument.summary}`.toLocaleLowerCase().includes(normalized));
  }, [allArguments, query]);
  return (
    <>
      <QuestionHeader
        state={state}
        label="主要原因"
        title={`${stance === 'oppose' ? '你反对' : stance === 'conditional' ? '你只在某些条件下支持' : '你支持'}这项决定的最主要原因是什么？`}
        statement={target?.text}
      />
      {allArguments.length > 6 ? (
        <label className="argument-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索题库理由" /></label>
      ) : null}
      <div className="argument-options" id="question-options">
        {argumentsForDisplay.map((argument) => (
          <button className="argument-row" type="button" key={argument.id} onClick={() => dispatch({ type: 'SELECT_ARGUMENT', argumentId: argument.id })}>
            <span className="argument-copy">
              <strong>{argument.title}</strong>
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
  const options = [
    ['true', '接受这个假设，继续判断', 'support'],
    ['false', '我不接受这个假设', 'oppose'],
    ['unknown', '我不确定这个假设是否成立', null],
  ];
  return (
    <>
      <QuestionHeader state={state} label="核对一个假设" title="下面先假设这件事确实发生。你愿意在这个假设下继续判断吗？" statement={fact?.statement} />
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

function FactSensitivityQuestion({ state, dispatch }) {
  const fact = facts[state.pendingSensitivity?.factId];
  const scenario = fact?.sensitivity?.scenarios?.[state.pendingSensitivity?.index];
  if (!fact || !scenario) return null;
  return (
    <>
      <QuestionHeader state={state} label="数字变化" title="这个数字变化后，你还会采用刚才的理由吗？" statement={`${fact.sensitivity.label}：${scenario.label}。${scenario.question}`} />
      <p className="explanation-line">基准情景是“{fact.sensitivity.baseline}”。这里记录理由在哪个幅度开始翻转，不修改你刚才的事实回答。</p>
      <ChoiceList options={[
        { id: 'sufficient', label: '这个幅度仍足以采用当前理由', tone: 'support', onSelect: () => dispatch({ type: 'ANSWER_FACT_SENSITIVITY', response: 'sufficient' }) },
        { id: 'insufficient', label: '这个幅度已不足以采用当前理由', tone: 'oppose', onSelect: () => dispatch({ type: 'ANSWER_FACT_SENSITIVITY', response: 'insufficient' }) },
        { id: 'uncertain', label: '暂时无法判断翻转点', onSelect: () => dispatch({ type: 'ANSWER_FACT_SENSITIVITY', response: 'uncertain' }) },
      ]} />
    </>
  );
}

function BridgeQuestion({ state, dispatch, onAskAi, aiLoading }) {
  const bridge = getCurrentBridge(state);
  return (
    <>
      <QuestionHeader state={state} label="判断理由" title="即使刚才的假设成立，这一点也足以成为支持你判断的理由吗？" statement={bridge?.text} />
      <ChoiceList options={[
        { id: 'accept', label: '是，这足以成为理由', tone: 'support', onSelect: () => dispatch({ type: 'ANSWER_BRIDGE', response: 'accept' }) },
        { id: 'reject', label: '不是，这还不足以成为理由', tone: 'oppose', onSelect: () => dispatch({ type: 'ANSWER_BRIDGE', response: 'reject' }) },
        { id: 'uncertain', label: '暂时不能判断', onSelect: () => dispatch({ type: 'ANSWER_BRIDGE', response: 'uncertain' }) },
      ]} />
      <FreeInput state={state} dispatch={dispatch} onAskAi={onAskAi} aiLoading={aiLoading} />
    </>
  );
}

function FormalQuestion({ state, dispatch }) {
  const pending = state.pendingFormalQuestion;
  if (!pending) return null;
  const plainPrompts = {
    '这些事实是否真的与这个具体政策元素相关？': '这些情况与当前判断确实有关吗？',
    '这条原则在当前对象和范围内适用吗？': '这个理由也适用于当前对象和范围吗？',
    '这项事实是否真的支持该原则的完整适用范围？': '刚才的情况足以支持这个理由在这里适用吗？',
    '是否有未处理的竞争价值限制这项原则？': '有没有其他同样重要的考虑，会限制这个理由在这里适用？',
  };
  const prompt = plainPrompts[pending.prompt] || pending.prompt
    .replaceAll('这个具体政策元素', '你当前的判断')
    .replaceAll('规范结论', '判断')
    .replaceAll('这条原则', '这个理由')
    .replaceAll('该原则', '这个理由');
  return (
    <>
      <QuestionHeader state={state} label="再确认一点" title={prompt} />
      <ChoiceList options={[
        { id: 'satisfied', label: '是，继续', tone: 'support', onSelect: () => dispatch({ type: 'ANSWER_FORMAL_QUESTION', response: 'satisfied' }) },
        { id: 'defeated', label: '不是，这会改变我的理由', tone: 'oppose', onSelect: () => dispatch({ type: 'ANSWER_FORMAL_QUESTION', response: 'defeated' }) },
        { id: 'unknown', label: '暂时不能判断', onSelect: () => dispatch({ type: 'ANSWER_FORMAL_QUESTION', response: 'unknown' }) },
      ]} />
    </>
  );
}

function DepthQuestion({ state, dispatch }) {
  const bridge = claims[state.currentChain?.steps.at(-1)?.bridgeClaimId];
  const canNominate = canNominateClaim(bridge);
  return (
    <>
      <QuestionHeader state={state} label="继续追问" title="你还想继续追问“为什么”吗？" statement={bridge?.text} />
      <ChoiceList options={[
        {
          id: 'fixed',
          label: canNominate ? '这就是我目前最根本的理由' : '这里还不能停止追问',
          disabled: !canNominate,
          onSelect: () => dispatch({ type: 'ACCEPT_CURRENT_REASON_AS_TERMINAL' }),
        },
        { id: 'deeper', label: '继续追问为什么', onSelect: () => dispatch({ type: 'SET_DEPTH', decision: 'deeper' }) },
        { id: 'uncertain', label: '我暂时说不清', onSelect: () => dispatch({ type: 'SET_DEPTH', decision: 'uncertain' }) },
      ]} />
    </>
  );
}

function TerminalQuestion({ state, dispatch }) {
  const claimId = state.currentChain?.terminal?.claimId || state.currentChain?.steps.at(-1)?.bridgeClaimId;
  const claim = claims[claimId];
  return (
    <>
      <QuestionHeader state={state} label="继续追问" title="这是你目前愿意停下来的理由吗？" statement={claim?.text} />
      <ChoiceList options={[
        { id: 'accept', label: '这就是我目前最根本的理由', onSelect: () => dispatch({ type: 'CONFIRM_TERMINAL', response: 'accept' }) },
        { id: 'continue', label: '继续追问为什么', onSelect: () => dispatch({ type: 'CONFIRM_TERMINAL', response: 'continue' }) },
        { id: 'uncertain', label: '我暂时说不清', onSelect: () => dispatch({ type: 'CONFIRM_TERMINAL', response: 'uncertain' }) },
      ]} />
    </>
  );
}

function StressRequiredQuestion({ state, dispatch }) {
  const claim = claims[state.currentChain?.terminal?.claimId];
  const [scenario, setScenario] = useState('');
  const [question, setQuestion] = useState('在这个结构相似但对象不同的案例中，你仍接受这条判断吗？');
  return (
    <>
      <QuestionHeader state={state} label="补充相似案例" title="先给这条判断找一个真正能检验它的案例" statement={claim?.text} />
      <p className="explanation-line">题库还没有预写压力测试。补足一个对象不同但关键结构相同的案例后，才能把它作为有效的暂定出发点。</p>
      <div className="inline-form">
        <label htmlFor="custom-stress-scenario">结构相似案例</label>
        <textarea id="custom-stress-scenario" rows={3} value={scenario} onChange={(event) => setScenario(event.target.value)} />
        <label htmlFor="custom-stress-question">要检查的问题</label>
        <textarea id="custom-stress-question" rows={2} value={question} onChange={(event) => setQuestion(event.target.value)} />
        <button className="button primary" type="button" disabled={!scenario.trim() || !question.trim()} onClick={() => dispatch({ type: 'SET_CUSTOM_STRESS_TEST', scenario, question, source: 'user' })}>使用这个案例继续检验</button>
        <button className="button quiet" type="button" onClick={() => dispatch({ type: 'MISSING_STRESS_TEST' })}>暂时无法提供，保留为未解决</button>
      </div>
    </>
  );
}

function StressQuestion({ state, dispatch }) {
  const claim = claims[state.currentChain?.terminal?.claimId];
  const stress = state.pendingCustomStressTest || claim?.stressTest || {};
  const [distinctionOpen, setDistinctionOpen] = useState(false);
  const [distinction, setDistinction] = useState('');
  return (
    <>
      <QuestionHeader state={state} label="相似案例检验" title={stress.question || '换一个对象后，你仍接受这条判断吗？'} statement={stress.scenario || claim?.example} />
      {stress.distinctions?.length ? <ul className="distinction-list">{stress.distinctions.map((item) => <li key={item}>{item}</li>)}</ul> : null}
      <ChoiceList options={[
        { id: 'apply', label: '仍然适用', onSelect: () => dispatch({ type: 'ANSWER_STRESS', response: 'apply' }) },
        { id: 'qualified', label: '有一个重要区别需要补充', onSelect: () => setDistinctionOpen(true) },
        { id: 'unexplained', label: '只在原情况适用，但我说不清区别', onSelect: () => dispatch({ type: 'ANSWER_STRESS', response: 'unexplained_exception' }) },
        { id: 'retract', label: '这让我撤回刚才的理由', onSelect: () => dispatch({ type: 'ANSWER_STRESS', response: 'retract' }) },
        { id: 'uncertain', label: '暂时不能判断', onSelect: () => dispatch({ type: 'ANSWER_STRESS', response: 'uncertain' }) },
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

function DefeaterQuestion({ state, dispatch }) {
  const chain = getSelectedChain(state);
  const policy = getCurrentPolicy(state);
  const oppositeClaimId = chain?.direction === 'support' ? policy?.opposeClaimId : policy?.supportClaimId;
  const candidates = getArgumentsForClaim(oppositeClaimId);
  return (
    <>
      <QuestionHeader state={state} label="换一个角度" title="下面哪条相反理由最可能让你重新考虑？" />
      <div className="argument-options">
        {candidates.map((argument) => (
          <button className="argument-row" type="button" key={argument.id} onClick={() => dispatch({ type: 'SELECT_DEFEATER', argumentId: argument.id })}>
            <span className="argument-copy"><strong>{argument.title}</strong></span>
            <ArrowRight size={18} />
          </button>
        ))}
      </div>
      <button className="button quiet full-width" type="button" onClick={() => dispatch({ type: 'NO_DEFEATER_ACCEPTED' })}>这些理由都不会改变我的判断</button>
    </>
  );
}

function DefeaterFactQuestion({ state, dispatch }) {
  const argument = argumentsById[state.pendingDefeaterArgumentId];
  const factId = argument?.factIds?.[state.pendingDefeaterFactIndex];
  const fact = facts[factId];
  if (!fact) return null;
  return (
    <>
      <QuestionHeader state={state} label={`换一个角度 ${state.pendingDefeaterFactIndex + 1} / ${argument.factIds.length}`} title="先假设下面这件事确实发生。它会让你重新考虑吗？" statement={fact.statement} />
      <ChoiceList options={[
        { id: 'true', label: '接受这个假设，继续判断', onSelect: () => dispatch({ type: 'ANSWER_DEFEATER_FACT', response: 'true' }) },
        { id: 'false', label: '我不接受这个假设', onSelect: () => dispatch({ type: 'ANSWER_DEFEATER_FACT', response: 'false' }) },
        { id: 'unknown', label: '暂时不能判断', onSelect: () => dispatch({ type: 'ANSWER_DEFEATER_FACT', response: 'unknown' }) },
      ]} />
    </>
  );
}

function DefeaterBridgeQuestion({ state, dispatch }) {
  const argument = argumentsById[state.pendingDefeaterArgumentId];
  const bridge = claims[argument?.bridgeClaimId];
  if (!argument || !bridge) return null;
  return (
    <>
      <QuestionHeader state={state} label="换一个角度" title="即使这些情况都是真的，这也足以成为与你原判断相反的理由吗？" statement={bridge.text} />
      <ChoiceList options={[
        { id: 'accept', label: '是，这足以成为理由', onSelect: () => dispatch({ type: 'ANSWER_DEFEATER_BRIDGE', response: 'accept' }) },
        { id: 'reject', label: '不是，这还不足以成为理由', onSelect: () => dispatch({ type: 'ANSWER_DEFEATER_BRIDGE', response: 'reject' }) },
        { id: 'uncertain', label: '暂时不能判断', onSelect: () => dispatch({ type: 'ANSWER_DEFEATER_BRIDGE', response: 'uncertain' }) },
      ]} />
    </>
  );
}

function DefeaterImpactQuestion({ state, dispatch }) {
  const argument = argumentsById[state.pendingDefeaterArgumentId];
  const bridge = claims[argument?.bridgeClaimId];
  if (!argument) return null;
  const acceptedPremises = argument.factIds.every((factId) => state.pendingDefeaterFactResponses[factId] === 'true');
  const formalReady = !argument.formalization || state.pendingDefeaterFormalStatus === 'qualified';
  return (
    <>
      <QuestionHeader state={state} label="它带来的影响" title="这个相反理由会怎样改变你的判断？" statement={argument.title} />
      <section className="defeater-preview">
        <ul>{(argument.plainSteps?.facts || []).map((statement) => <li key={statement}>{statement}</li>)}</ul>
        <p>{bridge?.text}</p>
      </section>
      {!formalReady && argument.formalization ? <p className="evidence-warning" role="note"><AlertTriangle size={17} />这条理由还有一个问题没有确认，因此暂时不会改变你的判断。</p> : null}
      <ChoiceList options={state.pendingDefeaterBridgeResponse === 'accept' && acceptedPremises && formalReady ? [
        { id: 'supplement', label: '不会改变', onSelect: () => dispatch({ type: 'ANSWER_DEFEATER', effect: 'supplement' }) },
        { id: 'weaken', label: '会让我有所犹豫，但仍维持原判断', onSelect: () => dispatch({ type: 'ANSWER_DEFEATER', effect: 'weaken' }) },
        { id: 'offset', label: '现在暂时不能判断', onSelect: () => dispatch({ type: 'ANSWER_DEFEATER', effect: 'offset' }) },
        { id: 'outweigh', label: '会使我改为相反判断', tone: 'oppose', onSelect: () => dispatch({ type: 'ANSWER_DEFEATER', effect: 'outweigh' }) },
      ] : [
        { id: 'reject', label: '暂时不会改变我的判断', onSelect: () => dispatch({ type: 'ANSWER_DEFEATER', effect: 'reject' }) },
      ]} />
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
  const chain = getSelectedChain(state);
  const record = state.records[policy?.id] || {};
  const status = chain?.status || 'unresolved';
  const effect = chain?.defeaterReview?.effect || chain?.defeaterReview?.impact;
  const hasNext = state.selectedPolicyPosition + 1 < state.selectedPolicyIds.length;
  const copy = effect === 'outweigh'
    ? '相反理由改变了你的最终判断。'
    : effect === 'offset'
      ? '正反理由让你暂时不能作出最终判断。'
      : effect === 'weaken'
        ? '相反理由让你有所犹豫，但没有改变最终判断。'
        : status === 'unresolved'
          ? '这道题暂时没有形成完整判断。'
          : '这道题已经回答完毕。';

  useEffect(() => {
    if (!state.simpleFlow) return undefined;
    const timer = window.setTimeout(() => dispatch({ type: 'NEXT_QUESTIONNAIRE' }), 650);
    return () => window.clearTimeout(timer);
  }, [dispatch, state.selectedChainId, state.simpleFlow]);

  return (
    <section className="completion-screen">
      <span className={`completion-icon ${status}`}>{status === 'complete' ? <Check /> : <CircleHelp />}</span>
      <h1>{hasNext ? '继续下一题' : '本次答题完成'}</h1>
      <p>{copy}</p>
      <strong>{policy?.title}</strong>
      <p className="stance-change-summary">你的判断：{directionCopy[record.packageStanceAfterDefeater || record.stance] || '暂时不能判断'}</p>
      <div className="completion-actions">
        {!state.simpleFlow ? <button className="button primary" type="button" onClick={() => dispatch({ type: 'OPEN_OVERVIEW' })}>返回题目列表</button> : null}
        <button className="button quiet" type="button" onClick={() => dispatch({ type: 'SHOW_RESULTS' })}>现在查看结果</button>
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
      <h1>已确认 {uniqueCommitments.length} 项本轮暂定出发点</h1>
      {commitments.length !== uniqueCommitments.length ? <p>这些价值来自 {commitments.length} 条已结束的理由链。</p> : null}
      <p>接下来只比较题库中同时涉及两项已确认价值的具体冲突；也可以直接查看阶段结果。</p>
      <div className="completion-actions">
        <button className="button primary" type="button" onClick={() => dispatch({ type: 'START_DILEMMAS' })}>开始具体冲突检验</button>
        <button className="button secondary" type="button" onClick={() => dispatch({ type: 'SHOW_RESULTS' })}>直接查看阶段结果</button>
      </div>
    </section>
  );
}

const dilemmaOptions = (dispatch, type) => [
  ['left_strong', '明显选择 A'],
  ['left_slight', '略微选择 A'],
  ['equal', 'A 与 B 同等重要'],
  ['depends_on_context', '取决于尚未说明的条件'],
  ['incomparable', '两者在本题中不可通约'],
  ['undecided', '我暂时无法判断'],
  ['right_slight', '略微选择 B'],
  ['right_strong', '明显选择 B'],
].map(([response, label]) => ({
  id: response,
  label,
  onSelect: () => dispatch({ type, response }),
}));

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
      <ChoiceList options={dilemmaOptions(dispatch, 'ANSWER_DILEMMA')} />
    </>
  );
}

function DilemmaSensitivityQuestion({ state, dispatch }) {
  const pending = state.dilemmaSensitivity;
  const item = dilemmas.find((entry) => entry.id === pending?.dilemmaId);
  const scenario = item?.sensitivity?.scenarios?.[pending?.index];
  if (!item || !scenario) return null;
  return (
    <>
      <QuestionHeader state={state} label="两难敏感性" title={scenario.question} statement={`${item.sensitivity.label}：${scenario.label}`} />
      <p className="explanation-line">基准回答已经保留；这个变体只检查量化差额改变后，局部价值关系是否翻转。</p>
      <ChoiceList options={dilemmaOptions(dispatch, 'ANSWER_DILEMMA_SENSITIVITY')} />
    </>
  );
}

const recordStatusCopy = {
  complete: '已完整结束',
  conditional: '已结束，有条件',
  tension: '已结束，有张力',
  unresolved: '已结束，未解决',
};

function PolicyOverview({ state, dispatch }) {
  const finished = policies.filter((policy) => state.records[policy.id]?.chains?.length).length;
  const nextPolicy = policies.find((policy) => state.records[policy.id]?.draft)
    || policies.find((policy) => (
      !state.records[policy.id]?.chains?.length && state.records[policy.id]?.status !== 'skipped'
    ));
  const nextAction = !nextPolicy
    ? '查看结果'
    : state.records[nextPolicy.id]?.draft ? '继续答题' : state.startedAt ? '开始下一题' : '从第一题开始';
  return (
    <main className="policy-overview">
      <header className="overview-header">
        <div>
          <span>题目列表</span>
          <h1>从哪一道开始？</h1>
          <p>系统会从你选中的题目开始，之后按顺序继续；不想回答时可以直接跳过。</p>
        </div>
        <div className="overview-actions">
          <button className="button primary" type="button" onClick={() => dispatch({ type: nextPolicy ? 'START_QUESTIONNAIRE' : 'SHOW_RESULTS', policyId: nextPolicy?.id })}>
            {nextAction}<ArrowRight size={17} />
          </button>
          {finished ? <button className="button secondary" type="button" onClick={() => dispatch({ type: 'SHOW_RESULTS' })}><BarChart3 size={17} />查看结果</button> : null}
          <button className="icon-button" type="button" title="回到主页" aria-label="回到主页" onClick={() => dispatch({ type: 'EXIT_TO_LANDING' })}><House size={19} /></button>
        </div>
      </header>

      <ol className="policy-list">
        {policies.map((policy, index) => {
          const record = state.records[policy.id];
          const hasDraft = Boolean(record?.draft);
          const hasChains = Boolean(record?.chains?.length);
          const skipped = !hasDraft && !hasChains && record?.status === 'skipped';
          const direction = record?.draft?.currentChain?.direction || record?.packageStanceAfterDefeater || record?.stance;
          const status = hasDraft ? '进行中' : hasChains ? record.mixed ? '已结束，状态混合' : recordStatusCopy[record.status] || '已结束' : skipped ? '已跳过' : '未开始';
          const statusClass = hasDraft ? 'active' : hasChains ? record.status : skipped ? 'skipped' : 'not-started';
          const action = hasDraft ? '继续' : hasChains ? '重新回答' : '从这里开始';
          return (
            <li className="policy-row" data-policy-id={policy.id} key={policy.id}>
              <span className="policy-number">{String(index + 1).padStart(2, '0')}</span>
              <div className="policy-row-title">
                <h2>{policy.shortTitle || policy.title}</h2>
                <small>{policy.selection?.domain || '自选题目'}</small>
                {direction ? <span className="direction-badge">{directionCopy[direction] || '已回答'}</span> : null}
              </div>
              <span className={`policy-status ${statusClass}`}>{status}</span>
              <button className="button quiet" type="button" aria-label={`${action}：${policy.shortTitle || policy.title}`} onClick={() => dispatch({ type: 'START_QUESTIONNAIRE', policyId: policy.id })}>
                <span>{action}</span><ArrowRight size={17} />
              </button>
            </li>
          );
        })}
      </ol>
    </main>
  );
}

function PhaseQuestion({ state, dispatch, onAskAi, aiLoading }) {
  const props = { state, dispatch, onAskAi, aiLoading };
  switch (state.phase) {
    case PHASES.COMPONENTS: return state.simpleFlow
      ? <SimpleComponentQuestion state={state} dispatch={dispatch} />
      : <ComponentQuestion state={state} dispatch={dispatch} />;
    case PHASES.STANCE: return <StanceQuestion {...props} />;
    case PHASES.PACKAGE_TRADEOFF: return <PackageTradeoffQuestion state={state} dispatch={dispatch} />;
    case PHASES.DIRECTION: return <DirectionQuestion {...props} />;
    case PHASES.ARGUMENT: return <ArgumentQuestion {...props} />;
    case PHASES.FACT: return <FactQuestion {...props} />;
    case PHASES.FACT_SENSITIVITY: return <FactSensitivityQuestion state={state} dispatch={dispatch} />;
    case PHASES.BRIDGE: return <BridgeQuestion {...props} />;
    case PHASES.FORMAL_QUESTION: return <FormalQuestion state={state} dispatch={dispatch} />;
    case PHASES.DEPTH: return <DepthQuestion {...props} />;
    case PHASES.TERMINAL_CONFIRM: return <TerminalQuestion {...props} />;
    case PHASES.STRESS_REQUIRED: return <StressRequiredQuestion state={state} dispatch={dispatch} />;
    case PHASES.STRESS: return <StressQuestion {...props} />;
    case PHASES.DEFEATER: return <DefeaterQuestion state={state} dispatch={dispatch} />;
    case PHASES.DEFEATER_FACT: return <DefeaterFactQuestion state={state} dispatch={dispatch} />;
    case PHASES.DEFEATER_BRIDGE: return <DefeaterBridgeQuestion state={state} dispatch={dispatch} />;
    case PHASES.DEFEATER_IMPACT: return <DefeaterImpactQuestion state={state} dispatch={dispatch} />;
    case PHASES.CONFLICT: return <ConflictQuestion {...props} />;
    case PHASES.BROKEN: return <BrokenQuestion {...props} />;
    case PHASES.POLICY_COMPLETE: return <PolicyComplete state={state} dispatch={dispatch} />;
    case PHASES.DILEMMA_INTRO: return <DilemmaIntro state={state} dispatch={dispatch} />;
    case PHASES.DILEMMA: return <DilemmaQuestion state={state} dispatch={dispatch} />;
    case PHASES.DILEMMA_SENSITIVITY: return <DilemmaSensitivityQuestion state={state} dispatch={dispatch} />;
    default: return <div className="empty-state"><AlertTriangle />当前步骤无法显示。</div>;
  }
}

export default function Assessment({ state, dispatch, sessionControls, onAskAi, aiLoading }) {
  if (state.phase === PHASES.POLICY_OVERVIEW) return <PolicyOverview state={state} dispatch={dispatch} />;
  return (
    <main className="workspace">
      <nav className="workspace-toolbar" aria-label="答题导航">
        <button className="icon-button workspace-home" type="button" title="回到主页" aria-label="回到主页" onClick={() => dispatch({ type: 'EXIT_TO_LANDING' })}><House size={19} /></button>
        <button className="button quiet previous-answer" type="button" disabled={!sessionControls.canGoBack} onClick={() => dispatch({ type: 'GO_BACK' })}><ArrowLeft size={17} />上一题</button>
        <button className="button quiet question-list-link" type="button" onClick={() => dispatch({ type: 'OPEN_OVERVIEW' })}><ListChecks size={17} />题目列表</button>
        <button className="button quiet stop-answering" type="button" onClick={() => dispatch({ type: 'SHOW_RESULTS' })}>中止并看结果</button>
      </nav>
      <section className="question-surface">
        <PhaseQuestion state={state} dispatch={dispatch} onAskAi={onAskAi} aiLoading={aiLoading} />
      </section>
      <ProofView
        entries={sessionControls.answerHistory}
        onRevisit={sessionControls.goBackTo}
      />
    </main>
  );
}
