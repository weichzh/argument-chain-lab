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
import { getQuestion } from '../lib/decisionEngine.js';
import {
  getModelV4,
  getPolicyV4,
  getTermExplanationV4,
} from '../lib/modelV4.js';
import QuestionCard from './QuestionCard.jsx';
import ReviewAnswers from './ReviewAnswers.jsx';
import TermHelp from './TermHelp.jsx';

function ScenarioDetails({ fixedConditions, terms }) {
  if (!fixedConditions?.length && !terms?.length) return null;
  return (
    <div className="v4-scenario-details">
      {fixedConditions?.length ? (
        <div>
          <h2>本题边界</h2>
          <ul>{fixedConditions.map((item) => (
            <li key={item.id}><strong>{item.text}</strong><span>{item.explanation}</span></li>
          ))}</ul>
        </div>
      ) : null}
      {terms?.length ? (
        <div className="v4-term-list" aria-label="名词解释">
          {terms.map((term) => <TermHelp key={term} term={term} explanation={getTermExplanationV4(term)} />)}
        </div>
      ) : null}
    </div>
  );
}

function RevisionDiff({ policy, question }) {
  if (question.kind !== 'revision_test') return null;
  return (
    <dl className="v4-frame-diff">
      {question.changedDimensionIds.map((dimensionId) => (
        <React.Fragment key={dimensionId}>
          <dt>{policy.dimensions[dimensionId].label}</dt>
          <dd>{policy.dimensions[dimensionId].explanation}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

function CustomReason({ state, dispatch, onAskAi, aiLoading }) {
  const key = sessionDraftKey(state.activeClaimId);
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
        placeholder="只写当前判断最主要的理由。"
      />
      <div className="v4-custom-actions">
        <button className="button secondary" type="button" disabled={!draft.trim()} onClick={() => submit({ text: draft.trim() })}>
          保存这条理由
        </button>
        <button
          className="button quiet"
          type="button"
          disabled={!draft.trim() || aiLoading}
          onClick={() => onAskAi({ text: draft.trim(), claimId: state.activeClaimId, onConfirm: submit })}
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
      <textarea id="stress-distinction" rows={3} maxLength={1000} value={text} onChange={(event) => setText(event.target.value)} />
      <button className="button primary" type="button" disabled={!text.trim()} onClick={() => onSubmit(text.trim())}>确认区别并继续</button>
    </div>
  );
}

export default function Questionnaire({ state, dispatch, sessionControls, onAskAi, aiLoading }) {
  const model = getModelV4();
  const policy = getPolicyV4(state.currentPolicyId);
  const question = useMemo(() => getQuestion(model, state), [model, state]);
  const [distinctionOpen, setDistinctionOpen] = useState(false);

  useEffect(() => {
    setDistinctionOpen(false);
    window.scrollTo(0, 0);
  }, [state.phase, state.currentPolicyId, state.diagnosticIndex, state.premiseIndex]);

  const handleAnswer = (optionId) => {
    if (question.kind === 'stress_test' && optionId === 'qualified') {
      setDistinctionOpen(true);
      return;
    }
    dispatch({ type: 'ANSWER', optionId });
  };

  return (
    <main className="workspace v4-workspace">
      <nav className="workspace-toolbar" aria-label="答题导航">
        <button className="icon-button workspace-home" type="button" title="回到主页" aria-label="回到主页" onClick={() => dispatch({ type: 'EXIT_TO_LANDING' })}><House size={19} /></button>
        <button className="button quiet previous-answer" type="button" title="上一题" disabled={!sessionControls.canGoBack} onClick={() => dispatch({ type: 'GO_BACK' })}><ArrowLeft size={17} />上一题</button>
        <button className="button quiet question-list-link" type="button" title="题目列表" onClick={() => dispatch({ type: 'OPEN_OVERVIEW' })}><ListChecks size={17} />题目列表</button>
        {question.kind === 'policy_decision' ? (
          <button className="button quiet" type="button" title="跳过这道题" onClick={() => dispatch({ type: 'SKIP_POLICY' })}><SkipForward size={17} />跳过</button>
        ) : null}
        <button className="button quiet stop-answering" type="button" title="中止并看结果" onClick={() => dispatch({ type: 'SHOW_RESULTS' })}><Eye size={17} />中止并看结果</button>
      </nav>

      <QuestionCard question={{ ...question, options: question.kind === 'custom_reason_required' ? [] : question.options }} context={`${policy.shortTitle} · ${state.policyPosition + 1} / ${state.policyIds.length}`} onAnswer={handleAnswer}>
        {question.kind === 'policy_decision' ? <ScenarioDetails fixedConditions={question.fixedConditions} terms={question.terms} /> : null}
        <RevisionDiff policy={policy} question={question} />
        {question.kind === 'custom_reason_required' ? (
          <CustomReason state={state} dispatch={dispatch} onAskAi={onAskAi} aiLoading={aiLoading} />
        ) : null}
        {distinctionOpen ? <StressDistinction onSubmit={(distinction) => dispatch({ type: 'ANSWER', optionId: 'qualified', extra: { distinction } })} /> : null}
      </QuestionCard>

      <ReviewAnswers entries={sessionControls.answerHistory} onRevisit={(answerId) => dispatch({ type: 'BACK_TO_ANSWER', answerId })} />
    </main>
  );
}
