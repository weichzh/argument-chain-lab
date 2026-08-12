import React, { useEffect, useState } from 'react';
import AIConfigPanel from './components/AIConfigPanel.jsx';
import CandidateReview from './components/CandidateReview.jsx';
import Header from './components/Header.jsx';
import Landing from './components/Landing.jsx';
import LocalDataPanel from './components/LocalDataPanel.jsx';
import PolicyOverview from './components/PolicyOverview.jsx';
import Questionnaire from './components/Questionnaire.jsx';
import ResultSummary from './components/ResultSummary.jsx';
import { loadFormalBank } from './data/bank.js';
import { VIEWS, useSession } from './hooks/useSession.js';
import { proposeWithPiAgent } from './lib/aiAgent.js';
import { configureModelV4, getClaimV4, getPolicyV4 } from './lib/modelV4.js';
import { validateArgumentCandidate } from './lib/sessionOverlay.js';

function LoadingScreen({ error, onRetry }) {
  return (
    <main className="boot-screen">
      <div className="brand-wordmark">论证链实验室</div>
      {error ? (
        <div className="boot-message" role="alert">
          <h1>正式题库没有加载成功</h1>
          <p>{error}</p>
          <button className="button primary" type="button" onClick={onRetry}>重新读取题库</button>
        </div>
      ) : (
        <div className="boot-message" aria-live="polite"><span className="loading-line" /><p>正在读取版本化题库…</p></div>
      )}
    </main>
  );
}

function ReadyApp({ bankManifest }) {
  const [state, dispatch, sessionControls] = useSession();
  const [configOpen, setConfigOpen] = useState(false);
  const [localDataOpen, setLocalDataOpen] = useState(false);
  const [aiConfig, setAiConfig] = useState(null);
  const [aiStatus, setAiStatus] = useState({ loading: false, error: null });
  const [pendingAiRequest, setPendingAiRequest] = useState(null);
  const [candidateReview, setCandidateReview] = useState(null);

  const runAiRequest = async (request, config = aiConfig) => {
    if (!config) {
      setPendingAiRequest(request);
      setConfigOpen(true);
      return;
    }
    const claim = getClaimV4(request.claimId);
    const policy = getPolicyV4(state.currentPolicyId);
    if (!claim || !policy) return;
    const requestContext = {
      updatedAt: state.updatedAt,
      policyId: state.currentPolicyId,
      claimId: request.claimId,
    };
    const expectedDirection = state.chainMode === 'counter'
      ? state.rootAnswer === 'yes' ? 'oppose' : 'support'
      : state.rootAnswer === 'yes' ? 'support' : 'oppose';
    setAiStatus({ loading: true, error: null });
    try {
      const candidate = await proposeWithPiAgent({
        config,
        userText: request.text,
        scope: 'current_target',
        expectedDirection,
        context: {
          modelVersion: state.modelVersion,
          policy: { title: policy.title, scenario: policy.scenario.summary },
          currentTarget: { text: claim.text, kind: claim.kind },
          currentDirection: expectedDirection,
          currentPath: state.currentPath,
        },
      });
      setCandidateReview({ candidate, request, requestContext, scope: 'current_target', expectedDirection });
    } catch (error) {
      setAiStatus({ loading: false, error: error instanceof Error ? error.message : String(error) });
      return;
    }
    setAiStatus({ loading: false, error: null });
  };

  const applyAiConfig = (config) => {
    setAiConfig(config);
    setConfigOpen(false);
    if (pendingAiRequest) {
      const request = pendingAiRequest;
      setPendingAiRequest(null);
      window.setTimeout(() => runAiRequest(request, config), 0);
    }
  };

  const confirmCandidate = (candidate) => {
    if (!candidateReview
      || candidateReview.requestContext.updatedAt !== state.updatedAt
      || candidateReview.requestContext.policyId !== state.currentPolicyId
      || candidateReview.requestContext.claimId !== state.activeClaimId) {
      setCandidateReview(null);
      setAiStatus({ loading: false, error: '当前问题已经改变，请在新步骤重新整理理由。' });
      return;
    }
    const validation = validateArgumentCandidate(candidate, 'current_target', candidateReview.expectedDirection);
    if (!validation.ok || candidate.target.text !== getClaimV4(state.activeClaimId)?.text) {
      setAiStatus({ loading: false, error: validation.error || '候选不能改写当前正在说明的判断。' });
      return;
    }
    candidateReview.request.onConfirm({ candidate: validation.value });
    setCandidateReview(null);
  };

  return (
    <div className="app-root">
      <Header state={state} aiConfigured={Boolean(aiConfig)} onConfig={() => setConfigOpen(true)} onLocalData={() => setLocalDataOpen(true)} />
      {aiStatus.error ? <div className="global-alert" role="alert"><span>{aiStatus.error}</span><button type="button" onClick={() => setAiStatus((value) => ({ ...value, error: null }))}>关闭</button></div> : null}
      {state.migrationNotice ? (
        <div className="migration-notice" role="status"><span>{state.migrationNotice}</span><div><button type="button" onClick={() => setLocalDataOpen(true)}>查看旧版记录</button><button type="button" onClick={() => dispatch({ type: 'DISMISS_MIGRATION' })}>知道了</button></div></div>
      ) : null}
      {state.view === VIEWS.LANDING ? <Landing hasSavedProgress={sessionControls.hasSavedProgress} onStart={() => dispatch({ type: 'START' })} onBrowse={() => dispatch({ type: 'OPEN_OVERVIEW' })} onReset={sessionControls.clearLocalData} /> : null}
      {state.view === VIEWS.QUESTIONNAIRE ? <Questionnaire state={state} dispatch={dispatch} sessionControls={sessionControls} onAskAi={runAiRequest} aiLoading={aiStatus.loading} /> : null}
      {state.view === VIEWS.OVERVIEW ? <PolicyOverview state={state} dispatch={dispatch} sessionControls={sessionControls} /> : null}
      {state.view === VIEWS.RESULTS ? <ResultSummary state={state} dispatch={dispatch} sessionControls={sessionControls} bankManifest={bankManifest} /> : null}
      <AIConfigPanel open={configOpen} value={aiConfig} onApply={applyAiConfig} onClear={() => setAiConfig(null)} onClose={() => { setPendingAiRequest(null); setConfigOpen(false); }} />
      <LocalDataPanel open={localDataOpen} state={state} aiConfigured={Boolean(aiConfig)} bankVersion={bankManifest.default} onClear={() => { setAiConfig(null); sessionControls.clearLocalData(); setLocalDataOpen(false); }} onClose={() => setLocalDataOpen(false)} />
      <CandidateReview review={candidateReview} onConfirm={confirmCandidate} onClose={() => setCandidateReview(null)} />
    </div>
  );
}

export default function App() {
  const [attempt, setAttempt] = useState(0);
  const [bankState, setBankState] = useState({ loading: true, error: null, manifest: null });

  useEffect(() => {
    let active = true;
    setBankState({ loading: true, error: null, manifest: null });
    loadFormalBank()
      .then(({ manifest, model }) => {
        if (!active) return;
        configureModelV4(model);
        setBankState({ loading: false, error: null, manifest });
      })
      .catch((error) => {
        if (!active) return;
        setBankState({ loading: false, error: error instanceof Error ? error.message : String(error), manifest: null });
      });
    return () => { active = false; };
  }, [attempt]);

  if (bankState.loading || bankState.error) return <LoadingScreen error={bankState.error} onRetry={() => setAttempt((value) => value + 1)} />;
  return <ReadyApp bankManifest={bankState.manifest} />;
}
