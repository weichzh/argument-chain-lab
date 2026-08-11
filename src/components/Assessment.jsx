import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  CircleHelp,
  GitBranch,
  ListChecks,
  LogOut,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  assessmentModes,
  argumentsById,
  claims,
  dilemmas,
  facts,
  getArgumentsForClaim,
  getPolicyElements,
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
  getSelectedChain,
  PHASES,
} from '../lib/engine.js';
import { adaptiveProgress, selectNextAdaptivePolicy } from '../lib/ideology.js';
import ProofView from './ProofView.jsx';

const STAGES = [
  ['判断', [PHASES.COMPONENTS, PHASES.STANCE, PHASES.PACKAGE_TRADEOFF, PHASES.DIRECTION, PHASES.ARGUMENT]],
  ['事实', [PHASES.FACT, PHASES.FACT_SENSITIVITY]],
  ['原则', [PHASES.BRIDGE, PHASES.DEPTH]],
  ['价值', [PHASES.TERMINAL_CONFIRM]],
  ['检验', [
    PHASES.STRESS_REQUIRED,
    PHASES.STRESS,
    PHASES.DEFEATER,
    PHASES.DEFEATER_FACT,
    PHASES.DEFEATER_BRIDGE,
    PHASES.DEFEATER_IMPACT,
    PHASES.CONFLICT,
    PHASES.BROKEN,
    PHASES.POLICY_COMPLETE,
    PHASES.DILEMMA_INTRO,
    PHASES.DILEMMA,
    PHASES.DILEMMA_SENSITIVITY,
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
  support: '支持题设',
  oppose: '反对题设',
  undecided: '方向未定',
};

const modeAwareDirection = (direction, mode) => {
  if (!['support', 'oppose'].includes(direction)) return directionCopy[direction] || '尚未作答';
  const prefix = mode === 'conditional_scenario' ? '题设内' : '现实判断';
  return `${prefix}：${direction === 'support' ? '支持' : '反对'}`;
};

function ModeBadge({ state }) {
  return <span className="mode-badge">回答方式：{assessmentModes[state.assessmentMode]?.label || state.assessmentMode}</span>;
}

function PolicyFrame({ state }) {
  const policy = getCurrentPolicy(state);
  if (!policy || [PHASES.DILEMMA, PHASES.DILEMMA_SENSITIVITY, PHASES.DILEMMA_INTRO].includes(state.phase)) return null;
  const record = state.records[policy.id];
  const direction = state.currentChain?.direction || record?.direction || record?.stance;
  const tone = direction === 'support' || direction === 'oppose' ? direction : 'neutral';
  const scenarioConditions = getPolicyElements(policy, ['scenario_condition']);
  return (
    <section className={`policy-frame ${tone}`} aria-label="本题题设">
      <header>
        <span>题设</span>
        <strong className={`direction-badge ${tone}`}>{modeAwareDirection(direction, state.assessmentMode)}</strong>
      </header>
      <h2>{policy.shortTitle || policy.title}</h2>
      <p>{policy.proposition}</p>
      {policy.scope ? <p className="policy-scope"><strong>题设边界：</strong>{policy.scope}</p> : null}
      {scenarioConditions.length ? <ul className="scenario-condition-list">{scenarioConditions.map((item) => <li key={item.id}><strong>固定条件</strong><span>{item.label}</span></li>)}</ul> : null}
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
        { id: 'support', label: modeAwareDirection('support', state.assessmentMode), tone: 'support', onSelect: () => dispatch({ type: 'SET_STANCE', stance: 'support' }) },
        { id: 'oppose', label: modeAwareDirection('oppose', state.assessmentMode), tone: 'oppose', onSelect: () => dispatch({ type: 'SET_STANCE', stance: 'oppose' }) },
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
      {!conditional && !fact?.sourceIds?.length ? <p className="evidence-warning" role="note"><AlertTriangle size={17} />题库没有为这项现实描述附来源；请把它视为尚未核实，选择“我还不能判断”是有效回答。</p> : null}
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
  const target = getCurrentTargetClaim(state);
  return (
    <>
      <QuestionHeader state={state} label="判断依据" title="即使这些事实都成立，这条判断能支持结论吗？" statement={bridge?.text} />
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
      <QuestionHeader state={state} label="继续追问" title="你还想继续追问“为什么”吗？" statement={bridge?.text} />
      <ChoiceList options={[
        {
          id: 'fixed',
          label: canNominate ? '把它作为本轮暂定出发点' : '这条原则目前不能在这里停止',
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
      <QuestionHeader state={state} label="独立确认" title="你愿意暂时把追问停在这里吗？" statement={claim?.text} />
      <p className="explanation-line">这不是客观公理声明，只记录本轮追问暂时停在哪里。</p>
      <ChoiceList options={[
        { id: 'accept', label: '是，我现在直接接受它', onSelect: () => dispatch({ type: 'CONFIRM_TERMINAL', response: 'accept' }) },
        { id: 'continue', label: '不是，继续追问更深理由', onSelect: () => dispatch({ type: 'CONFIRM_TERMINAL', response: 'continue' }) },
        { id: 'reject', label: '我不愿把它作为本轮暂定出发点', onSelect: () => dispatch({ type: 'CONFIRM_TERMINAL', response: 'reject' }) },
        { id: 'uncertain', label: '暂时不能确认', onSelect: () => dispatch({ type: 'CONFIRM_TERMINAL', response: 'uncertain' }) },
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

function DefeaterQuestion({ state, dispatch }) {
  const chain = getSelectedChain(state);
  const policy = getCurrentPolicy(state);
  const oppositeClaimId = chain?.direction === 'support' ? policy?.opposeClaimId : policy?.supportClaimId;
  const candidates = getArgumentsForClaim(oppositeClaimId);
  return (
    <>
      <QuestionHeader state={state} label="最强反方" title="哪一条是你认为最值得认真对待的反方理由？" statement="先选题库里最强的一条，再记录它是否改变整包立场。" />
      <div className="argument-options">
        {candidates.map((argument) => (
          <button className="argument-row" type="button" key={argument.id} onClick={() => dispatch({ type: 'SELECT_DEFEATER', argumentId: argument.id })}>
            <span className="argument-copy"><strong>{argument.title}</strong><small>{argument.summary}</small></span>
            <ArrowRight size={18} />
          </button>
        ))}
      </div>
      <button className="button quiet full-width" type="button" onClick={() => dispatch({ type: 'NO_DEFEATER_ACCEPTED' })}>题库中没有我认为成立的反方理由</button>
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
      <QuestionHeader state={state} label={`反方事实 ${state.pendingDefeaterFactIndex + 1} / ${argument.factIds.length}`} title="这条反方理由依赖的事实成立吗？" statement={fact.statement} />
      {!fact.sourceIds?.length && state.assessmentMode === 'real_world_belief' ? <p className="evidence-warning" role="note"><AlertTriangle size={17} />题库未附现实来源；不能判断不会被当成反对。</p> : null}
      <ChoiceList options={[
        { id: 'true', label: state.assessmentMode === 'conditional_scenario' ? '作为题设采用' : '成立', onSelect: () => dispatch({ type: 'ANSWER_DEFEATER_FACT', response: 'true' }) },
        { id: 'false', label: state.assessmentMode === 'conditional_scenario' ? '不采用这项题设' : '不成立', onSelect: () => dispatch({ type: 'ANSWER_DEFEATER_FACT', response: 'false' }) },
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
      <QuestionHeader state={state} label="反方判断依据" title="即使这些反方事实都成立，你接受这条判断依据吗？" statement={bridge.text} />
      <ChoiceList options={[
        { id: 'accept', label: '接受这条判断依据', onSelect: () => dispatch({ type: 'ANSWER_DEFEATER_BRIDGE', response: 'accept' }) },
        { id: 'reject', label: '不接受这条判断依据', onSelect: () => dispatch({ type: 'ANSWER_DEFEATER_BRIDGE', response: 'reject' }) },
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
  return (
    <>
      <QuestionHeader state={state} label="反方影响" title="核对这些前提后，它怎样改变你的整包判断？" statement={argument.title} />
      <section className="defeater-preview">
        <strong>反方路径</strong>
        <ul>{(argument.plainSteps?.facts || []).map((statement) => <li key={statement}>{statement}</li>)}</ul>
        <p><b>B</b>{bridge?.text}</p>
      </section>
      <ChoiceList options={state.pendingDefeaterBridgeResponse === 'accept' && acceptedPremises ? [
        { id: 'supplement', label: '它补充了限制条件，但没有削弱原理由', onSelect: () => dispatch({ type: 'ANSWER_DEFEATER', effect: 'supplement' }) },
        { id: 'weaken', label: '它削弱了原理由，但我仍维持原立场', onSelect: () => dispatch({ type: 'ANSWER_DEFEATER', effect: 'weaken' }) },
        { id: 'offset', label: '正反理由暂时抵消，整包立场变为未定', onSelect: () => dispatch({ type: 'ANSWER_DEFEATER', effect: 'offset' }) },
        { id: 'outweigh', label: '它压过原理由，我改为相反立场', tone: 'oppose', onSelect: () => dispatch({ type: 'ANSWER_DEFEATER', effect: 'outweigh' }) },
      ] : [
        { id: 'reject', label: '记录为未接受，不改变整包立场', onSelect: () => dispatch({ type: 'ANSWER_DEFEATER', effect: 'reject' }) },
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
  const conditionalScenario = chain?.steps?.some((step) => step.assessmentMode === 'conditional_scenario');
  const nextAdaptive = state.adaptiveMode ? selectNextAdaptivePolicy(state) : null;
  const copy = {
    complete: ['本条理由链已闭合', ['supplement', 'weaken'].includes(effect)
      ? '你接受了所选反方理由；它已记录为补充或削弱，但没有改变整包立场。'
      : ['reject', 'none_accepted'].includes(effect)
        ? '题库中的反方理由没有改变你的整包立场。'
        : effect === 'outweigh'
          ? '原理由链仍然闭合，但最强反方理由压过了它，整包立场已经反转。'
          : effect === 'offset'
            ? '原理由链仍然闭合，但正反理由暂时抵消，整包立场变为未定。'
            : '事实、判断依据、本轮暂定出发点和反方复核都已记录。'],
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
      <p className="stance-change-summary">整包判断：{modeAwareDirection(record.packageStanceBeforeDefeater || record.direction || record.stance, state.assessmentMode)} → {modeAwareDirection(record.packageStanceAfterDefeater || record.stance, state.assessmentMode)}</p>
      <div className="completion-actions">
        {state.adaptiveMode ? (
          <button className="button primary" type="button" onClick={() => dispatch({ type: 'NEXT_ADAPTIVE' })}>
            {nextAdaptive ? `下一道推荐题：${nextAdaptive.shortTitle}` : '进入价值冲突检验'}
          </button>
        ) : <button className="button primary" type="button" onClick={() => dispatch({ type: 'OPEN_OVERVIEW' })}>返回题目列表</button>}
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
  const progress = adaptiveProgress(state);
  const recommended = selectNextAdaptivePolicy(state);
  return (
    <main className="policy-overview">
      <header className="overview-header">
        <div>
          <span>题目列表</span>
          <h1>走推荐路径，或自由选择题目</h1>
          <p>候选库有 {policies.length} 个场景；推荐路径只选 8 个核心场景和 2—4 个当前最有区分力的场景。</p>
        </div>
        <div className="overview-actions">
          {finished ? <button className="button secondary" type="button" onClick={() => dispatch({ type: 'SHOW_RESULTS' })}><BarChart3 size={17} />查看阶段结果</button> : null}
          <button className="button quiet" type="button" onClick={() => dispatch({ type: 'EXIT_TO_LANDING' })}><LogOut size={17} />退出</button>
        </div>
      </header>

      <AssessmentModeSelector state={state} dispatch={dispatch} />

      <section className="adaptive-entry" aria-label="自适应测评">
        <GitBranch size={26} aria-hidden="true" />
        <div>
          <strong>{recommended ? `下一道推荐：${recommended.shortTitle || recommended.title}` : '推荐路径已经取得足够区分信息'}</strong>
          <p>核心 {progress.coreDone} / {progress.coreTotal} · 自适应区分 {progress.adaptiveDone} / {progress.adaptiveMin}—{progress.adaptiveMax}</p>
        </div>
        {recommended ? (
          <button className="button primary" type="button" onClick={() => dispatch({ type: 'START_ADAPTIVE' })}>
            {progress.coreDone + progress.adaptiveDone ? '继续推荐路径' : '开始推荐路径'}<ArrowRight size={17} />
          </button>
        ) : <button className="button secondary" type="button" onClick={() => dispatch({ type: 'SHOW_RESULTS' })}>查看结果</button>}
      </section>

      <div className="overview-progress" aria-label="答题进度">
        <strong>{finished}</strong>
        <span>道题已结束{inProgress ? ` · ${inProgress} 道进行中` : ''} · 不需要回答整个候选库</span>
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
                <small>{policy.selection?.domain}{policy.selection?.tier === 'core' ? ' · 核心场景' : ' · 自适应场景'}</small>
                {recommended?.id === policy.id ? <span className="recommended-badge">当前推荐</span> : null}
                {direction ? <span className={`direction-badge ${tone}`}>{modeAwareDirection(direction, state.assessmentMode)}</span> : null}
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
    case PHASES.COMPONENTS: return <ComponentQuestion state={state} dispatch={dispatch} />;
    case PHASES.STANCE: return <StanceQuestion {...props} />;
    case PHASES.PACKAGE_TRADEOFF: return <PackageTradeoffQuestion state={state} dispatch={dispatch} />;
    case PHASES.DIRECTION: return <DirectionQuestion {...props} />;
    case PHASES.ARGUMENT: return <ArgumentQuestion {...props} />;
    case PHASES.FACT: return <FactQuestion {...props} />;
    case PHASES.FACT_SENSITIVITY: return <FactSensitivityQuestion state={state} dispatch={dispatch} />;
    case PHASES.BRIDGE: return <BridgeQuestion {...props} />;
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

export default function Assessment({ state, dispatch, onAskAi, aiLoading }) {
  if (state.phase === PHASES.POLICY_OVERVIEW) return <PolicyOverview state={state} dispatch={dispatch} />;
  const hasResults = Object.values(state.records).some((record) => record.chains?.length);
  return (
    <main className="workspace">
      <nav className="workspace-toolbar" aria-label="答题导航">
        <ModeBadge state={state} />
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
