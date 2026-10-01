import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Eye,
  House,
  ListChecks,
  SkipForward,
  Sparkles,
} from 'lucide-react';
import { sessionDraftKey } from '../hooks/useSession.js';
import { getCurrentPolicy, getQuestion, getReasonTargetId, proposalItemsFor } from '../lib/decisionEngine.js';
import { getModelV4, getPolicyV4 } from '../lib/modelV4.js';
import InlineTermText from './InlineTermText.jsx';
import QuestionCard from './QuestionCard.jsx';
import ReviewAnswers from './ReviewAnswers.jsx';
import PolicySnapshot from './PolicySnapshot.jsx';
import UncertaintyNote from './UncertaintyNote.jsx';
import RestartPolicyButton from './RestartPolicyButton.jsx';
import { attemptLabel } from '../lib/resultPresentation.js';
import '../styles-v13.css';

const CopyText = ({ children, definitions }) => (
  <InlineTermText text={children} definitions={definitions} />
);

function PolicyQuestionPrelude({ question, termDefinitions }) {
  return (
    <div className="v4-question-prelude">
      <p className="v4-scenario-summary">
        <CopyText definitions={termDefinitions}>{question.scenarioSummary}</CopyText>
      </p>
      {question.fixedConditions?.length ? (
        <section aria-labelledby="fixed-conditions-title">
          <h2 id="fixed-conditions-title">作答时，请按这些条件理解题目</h2>
          <ul>{question.fixedConditions.map((item) => (
            <li key={item.id}>
              <strong><CopyText definitions={termDefinitions}>{item.text}</CopyText></strong>
            </li>
          ))}</ul>
          {question.fixedConditions.some(item => item.explanation) ? <details className="condition-clarification">
            <summary>这些限定排除了什么？</summary>
            <ul>{question.fixedConditions.filter(item => item.explanation).map(item => <li key={item.id}><CopyText definitions={termDefinitions}>{item.explanation}</CopyText></li>)}</ul>
          </details> : null}
        </section>
      ) : null}
      <section aria-labelledby="proposal-title">
        <h2 id="proposal-title">题目中的完整方案包括</h2>
        <ul>{question.proposalItems.map((item) => (
          <li key={item.dimensionId}>
            <strong>{item.dimensionLabel}：</strong>
            <span><CopyText definitions={termDefinitions}>{item.valueLabel}</CopyText></span>
          </li>
        ))}</ul>
      </section>
    </div>
  );
}

function RevisionQuestionPrelude({ question, termDefinitions }) {
  return (
    <section className="v4-revision-prelude" aria-labelledby="revision-change-title">
      <p className="revision-progress">修改比较 {question.revisionNumber} / {question.revisionCount} · 每次都与原方案相比</p>
      <h2 id="revision-change-title">这次只改动下面这些内容</h2>
      <dl>
        {question.changes.map((change) => (
          <React.Fragment key={change.dimensionId}>
            <dt>{change.dimensionLabel}</dt>
            <dd>
              <span><CopyText definitions={termDefinitions}>{change.fromLabel}</CopyText></span>
              <span aria-hidden="true"> → </span>
              <strong><CopyText definitions={termDefinitions}>{change.toLabel}</CopyText></strong>
            </dd>
          </React.Fragment>
        ))}
      </dl>
      <p className="comparison-basis">未列出的安排保持原方案；之前未接受的修改不叠加。</p>
      {question.unchangedItems?.length ? <details className="revision-unchanged" key={question.candidateFrameId}>
        <summary>查看本次保持不变的安排</summary>
        <ul>{question.unchangedItems.map((item) => <li key={item.dimensionId}>
          <strong>{item.dimensionLabel}：</strong><CopyText definitions={termDefinitions}>{item.valueLabel}</CopyText>
        </li>)}</ul>
      </details> : null}
    </section>
  );
}

function QuestionPrelude({ question, termDefinitions }) {
  if (question.kind === 'policy_decision') {
    return <PolicyQuestionPrelude question={question} termDefinitions={termDefinitions} />;
  }
  if (question.kind === 'revision_test') {
    return <RevisionQuestionPrelude question={question} termDefinitions={termDefinitions} />;
  }
  return null;
}

function QuestionAfter({ question, state, dispatch, onAskAi, aiLoading, distinctionOpen }) {
  return (
    <>
      {question.kind === 'custom_reason_required' ? (
        <CustomReason state={state} dispatch={dispatch} onAskAi={onAskAi} aiLoading={aiLoading} />
      ) : null}
      {distinctionOpen ? (
        <StressDistinction onSubmit={(distinction) => dispatch({
          type: 'ANSWER',
          optionId: 'qualified',
          extra: { distinction },
        })} />
      ) : null}
    </>
  );
}

function CustomReason({ state, dispatch, onAskAi, aiLoading }) {
  const targetClaimId = getReasonTargetId(state);
  const key = sessionDraftKey(targetClaimId);
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

  const submit = (extra) => {
    update('');
    dispatch({ type: 'ANSWER', optionId: 'save_custom', extra });
  };

  return (
    <div className="v4-custom-reason">
      <label htmlFor="custom-reason">写下你的理由</label>
      <textarea
        id="custom-reason"
        rows={5}
        maxLength={4000}
        value={draft}
        onChange={(event) => update(event.target.value)}
        placeholder="例如：我接受上面这条原则，是因为……"
      />
      <div className="v4-custom-actions">
        <button className="button secondary" type="button" disabled={!draft.trim()} onClick={() => submit({ text: draft.trim() })}>
          保存这条理由
        </button>
        <button
          className="button quiet"
          type="button"
          disabled={!draft.trim() || aiLoading}
          onClick={() => onAskAi({ text: draft.trim(), claimId: targetClaimId, onConfirm: submit })}
        >
          <Sparkles size={17} />{aiLoading ? '正在整理' : '交给 AI 整理'}
        </button>
        <button className="button quiet" type="button" onClick={() => dispatch({ type: 'ANSWER', optionId: 'leave_unresolved' })}>
          暂时保留为未解决
        </button>
      </div>
    </div>
  );
}

function StressDistinction({ onSubmit }) {
  const [text, setText] = useState('');
  return (
    <div className="v4-distinction">
      <label htmlFor="stress-distinction">这个案例有什么重要区别？</label>
      <textarea autoFocus id="stress-distinction" rows={3} maxLength={1000} value={text} onChange={(event) => setText(event.target.value)} />
      <button className="button primary" type="button" disabled={!text.trim()} onClick={() => onSubmit(text.trim())}>确认区别并继续</button>
    </div>
  );
}

export default function Questionnaire({ state, dispatch, sessionControls, onAskAi, aiLoading }) {
  const model = getModelV4();
  const policy = getCurrentPolicy(model, state);
  const question = useMemo(() => getQuestion(model, state), [model, state]);
  const [distinctionOpen, setDistinctionOpen] = useState(false);

  useEffect(() => {
    setDistinctionOpen(false);
    document.querySelector('.v4-question-card')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [state.phase, state.currentPolicyId, state.diagnosticIndex, state.premiseIndex, state.activeClaimId, state.answerLog.length]);

  const handleAnswer = (optionId) => {
    if (question.kind === 'stress_test' && optionId === 'qualified') {
      setDistinctionOpen(true);
      return;
    }
    dispatch({ type: 'ANSWER', optionId });
  };

  const stage = question.kind === 'policy_done' ? 5
    : state.chainMode === 'counter' ? 4
    : question.kind === 'policy_decision' ? 0
    : question.kind === 'revision_test' ? 1
    : ['reason_choice', 'custom_reason_required'].includes(question.kind) ? 2 : 3;
  const completed = state.policyResults[state.currentPolicyId];
  const lastAttempt = state.rejectedReasonAttempts?.at(-1);

  return (
    <main className="workspace v4-workspace v13-workspace">
      <nav className="workspace-toolbar" aria-label="答题导航">
        <button className="icon-button workspace-home" type="button" title="回到主页" aria-label="回到主页" onClick={() => dispatch({ type: 'EXIT_TO_LANDING' })}><House size={19} /></button>
        <button className="button quiet previous-answer" type="button" title="上一题" disabled={!sessionControls.canGoBack} onClick={() => dispatch({ type: 'GO_BACK' })}><ArrowLeft size={17} />上一题</button>
        <button className="button quiet question-list-link" type="button" title="题目列表" onClick={() => dispatch({ type: 'OPEN_OVERVIEW' })}><ListChecks size={17} />题目列表</button>
        {question.kind === 'policy_decision' ? (
          <button className="button quiet" type="button" title="跳过这道题" onClick={() => dispatch({ type: 'SKIP_POLICY' })}><SkipForward size={17} />跳过</button>
        ) : null}
        <button className="button quiet stop-answering" type="button" title="中止并看结果" onClick={() => dispatch({ type: 'SHOW_RESULTS' })}><Eye size={17} />中止并看结果</button>
      </nav>

      <ol className="question-stages" aria-label="本题阶段">
        {['判断方案', '比较修改', '选择理由', '检查适用', '相反理由', '本题小结'].map((label, index) => <li key={label} aria-current={stage === index ? 'step' : undefined}>{label}</li>)}
      </ol>
      {lastAttempt && ['reason_choice', 'counter_reason_choice', 'why_or_stop', 'custom_reason_required'].includes(question.kind) ? <p className="attempt-notice" role="status">
        已保留上一条未确认的尝试：{attemptLabel(lastAttempt)}。这不表示你没有理由。
      </p> : null}
      <QuestionCard
        question={{ ...question, explanation: question.kind === 'revision_test' ? null : question.explanation, options: question.kind === 'custom_reason_required' ? [] : question.options }}
        context={`${policy.shortTitle} · ${state.policyPosition + 1} / ${state.policyIds.length}`}
        onAnswer={handleAnswer}
        termDefinitions={model.terms}
        beforeQuestion={<>
          <QuestionPrelude question={question} termDefinitions={model.terms} />
          {!['policy_decision', 'policy_done'].includes(question.kind) ? <details className="policy-reminder" key={`${policy.id}-${question.kind}`}>
            <summary>回看题设与完整原方案</summary>
            <PolicyQuestionPrelude question={{
              scenarioSummary: policy.scenario.summary,
              fixedConditions: policy.scenario.fixedConditions,
              proposalItems: proposalItemsFor(policy),
            }} termDefinitions={model.terms} />
          </details> : null}
        </>}
        beforeOptions={question.kind === 'policy_done' && completed ? <>
          <PolicySnapshot model={model} result={completed} />
          {(completed.rootAnswer === 'uncertain' || completed.unresolvedRevisionFrameId) ? <UncertaintyNote key={`${completed.policyId}-${completed.unresolvedRevisionFrameId || 'root'}`} result={completed} dispatch={dispatch} /> : null}
        </> : null}
        afterQuestion={(
          <QuestionAfter
            question={question}
            state={state}
            dispatch={dispatch}
            onAskAi={onAskAi}
            aiLoading={aiLoading}
            distinctionOpen={distinctionOpen}
          />
        )}
      />

      {question.kind === 'policy_done' ? <RestartPolicyButton policyId={policy.id} title={policy.shortTitle} dispatch={dispatch} /> : null}
      <ReviewAnswers entries={sessionControls.answerHistory} onRevisit={(answerId) => dispatch({ type: 'BACK_TO_ANSWER', answerId })} />
    </main>
  );
}
