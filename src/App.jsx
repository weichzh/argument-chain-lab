import React, { useEffect, useMemo, useRef, useState } from 'react';
import Assessment from './components/Assessment.jsx';
import AIConfigPanel from './components/AIConfigPanel.jsx';
import CandidateReview from './components/CandidateReview.jsx';
import Header from './components/Header.jsx';
import Landing from './components/Landing.jsx';
import LocalDataPanel from './components/LocalDataPanel.jsx';
import ResultsV2 from './components/ResultsV2.jsx';
import { loadFormalBank } from './data/bank.js';
import {
  argumentsById,
  claims,
  configureFormalModel,
  facts,
} from './data/model.js';
import { useSession } from './hooks/useSession.js';
import { proposeWithPiAgent } from './lib/aiAgent.js';
import { HttpBankClient } from './lib/bankClient.js';
import {
  getCurrentArgument,
  getCurrentBridge,
  getCurrentFact,
  getCurrentPolicy,
  getCurrentTargetClaim,
  PHASES,
} from './lib/engine.js';
import {
  candidateRequestMatchesState,
  mergeCandidateIntoOverlay,
  validateArgumentCandidate,
} from './lib/sessionOverlay.js';

const buildConfirmedGraph = (state) => (state.currentChain?.steps || []).map((step) => {
  const argument = argumentsById[step.argumentId];
  return {
    target: claims[step.targetClaimId]?.text,
    facts: (argument?.factIds || []).map((factId) => ({
      statement: facts[factId]?.statement,
      response: step.factResponses?.[factId],
    })),
    bridge: {
      text: claims[step.bridgeClaimId]?.text,
      response: step.bridgeResponse,
    },
  };
});

const buildAiContext = (state) => {
  const policy = getCurrentPolicy(state);
  const target = getCurrentTargetClaim(state);
  const argument = getCurrentArgument(state);
  const currentFact = getCurrentFact(state);
  const currentBridge = getCurrentBridge(state);
  return {
    bankVersion: state.modelVersion,
    policy: policy ? {
      title: policy.title,
      proposition: policy.proposition,
      scope: policy.scope,
    } : null,
    currentTarget: target ? { kind: target.kind, text: target.text } : null,
    currentDirection: state.currentChain?.direction || null,
    confirmedGraph: buildConfirmedGraph(state),
    necessaryBankSlice: {
      phase: state.phase,
      currentArgument: argument ? {
        title: argument.title,
        summary: argument.summary,
      } : null,
      currentFact: currentFact ? { statement: currentFact.statement } : null,
      currentBridge: currentBridge ? { text: currentBridge.text } : null,
    },
  };
};

const captureAiRequestContext = (state) => ({
  updatedAt: state.updatedAt,
  policyIndex: state.policyIndex,
  phase: state.phase,
  chainId: state.currentChain?.id || null,
  targetClaimId: state.currentTargetClaimId,
  argumentId: state.currentArgumentId,
  factIndex: state.currentFactIndex,
  stepCount: state.currentChain?.steps.length || 0,
  direction: state.currentChain?.direction || null,
});

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
        <div className="boot-message" aria-live="polite">
          <span className="loading-line" />
          <p>正在读取版本化题库…</p>
        </div>
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
  const [candidateReview, setCandidateReview] = useState(null);
  const [pendingAiRequest, setPendingAiRequest] = useState(null);
  const stateRef = useRef(state);
  const aiRequestController = useRef(null);
  stateRef.current = state;

  useEffect(() => () => aiRequestController.current?.abort(), []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [state.phase, state.policyIndex, state.currentFactIndex, state.pendingSensitivity?.index, state.dilemmaIndex, state.dilemmaSensitivity?.index]);

  const bankClient = useMemo(() => new HttpBankClient({
    endpoint: import.meta.env.VITE_BANK_ENDPOINT || window.__ARGUMENT_CHAIN_BANK_ENDPOINT__ || '',
  }), []);

  const runAiRequest = async (request, config = aiConfig) => {
    const prepared = request.requestContext ? request : {
      ...request,
      requestContext: captureAiRequestContext(state),
      aiContext: buildAiContext(state),
    };
    if (!config) {
      setPendingAiRequest(prepared);
      setConfigOpen(true);
      return;
    }
    if (!candidateRequestMatchesState(stateRef.current, prepared.requestContext)) {
      setPendingAiRequest(null);
      setAiStatus({ loading: false, error: '当前论证步骤已经改变，请在新步骤重新生成候选。' });
      return;
    }
    aiRequestController.current?.abort();
    const controller = new AbortController();
    aiRequestController.current = controller;
    setPendingAiRequest(null);
    setAiStatus({ loading: true, error: null });
    try {
      const candidate = await proposeWithPiAgent({
        config,
        userText: prepared.text,
        scope: prepared.scope,
        context: prepared.aiContext,
        expectedDirection: prepared.scope === 'current_target'
          ? prepared.requestContext.direction
          : null,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!candidateRequestMatchesState(stateRef.current, prepared.requestContext)) {
        setAiStatus({ loading: false, error: '生成期间论证步骤已经改变，这份过期候选没有写入当前链。' });
        return;
      }
      setCandidateReview({
        candidate,
        scope: prepared.scope,
        draftKey: prepared.draftKey,
        requestContext: prepared.requestContext,
        expectedDirection: prepared.scope === 'current_target'
          ? prepared.requestContext.direction
          : null,
      });
    } catch (error) {
      if (!controller.signal.aborted && aiRequestController.current === controller) {
        setAiStatus({ loading: false, error: error instanceof Error ? error.message : String(error) });
      }
    } finally {
      if (aiRequestController.current === controller) {
        aiRequestController.current = null;
        setAiStatus((current) => ({ ...current, loading: false }));
      }
    }
  };

  const applyAiConfig = (config) => {
    setAiConfig(config);
    setConfigOpen(false);
    if (pendingAiRequest) {
      window.setTimeout(() => runAiRequest(pendingAiRequest, config), 0);
    }
  };

  const confirmCandidate = (candidate) => {
    if (!candidateReview || !candidateRequestMatchesState(state, candidateReview.requestContext)) {
      setCandidateReview(null);
      setAiStatus({ loading: false, error: '当前论证步骤已经改变，请在新步骤重新生成候选。' });
      return;
    }
    const validation = validateArgumentCandidate(
      candidate,
      candidateReview.scope,
      candidateReview.expectedDirection,
    );
    if (!validation.ok) {
      setAiStatus({ loading: false, error: validation.error });
      return;
    }
    const currentTarget = getCurrentTargetClaim(state);
    if (candidateReview.scope === 'current_target' && candidate.target.text !== currentTarget?.text) {
      setAiStatus({ loading: false, error: '候选不能改写当前正在说明的结论。' });
      return;
    }
    const installed = mergeCandidateIntoOverlay(state.sessionOverlay, candidate, {
      currentTargetClaimId: candidateReview.scope === 'current_target'
        ? state.currentTargetClaimId
        : null,
    });
    dispatch({ type: 'SET_SESSION_OVERLAY', overlay: installed.overlay });
    if (candidateReview.scope === 'new_root') {
      dispatch({
        type: 'START_FROM_CANDIDATE',
        policyId: installed.policyId,
        argumentId: installed.argumentId,
        direction: installed.direction,
      });
    } else {
      dispatch({ type: 'USE_CANDIDATE_ARGUMENT', argumentId: installed.argumentId });
    }
    if (candidateReview.draftKey) {
      try {
        window.sessionStorage.removeItem(candidateReview.draftKey);
      } catch {
        // Draft storage is optional.
      }
    }
    setCandidateReview(null);
    setAiStatus({ loading: false, error: null });
  };

  const clearAiRuntime = () => {
    aiRequestController.current?.abort();
    aiRequestController.current = null;
    setAiConfig(null);
    setAiStatus({ loading: false, error: null });
    setCandidateReview(null);
    setPendingAiRequest(null);
  };

  return (
    <div className="app-root">
      <Header
        state={state}
        aiConfigured={Boolean(aiConfig)}
        onConfig={() => setConfigOpen(true)}
        onLocalData={() => setLocalDataOpen(true)}
      />

      {aiStatus.error ? (
        <div className="global-alert" role="alert">
          <span>{aiStatus.error}</span>
          <button type="button" onClick={() => setAiStatus((value) => ({ ...value, error: null }))}>关闭</button>
        </div>
      ) : null}

      {state.migrationNotice ? <p className="migration-notice" role="status">{state.migrationNotice}</p> : null}

      {state.phase === PHASES.LANDING ? (
        <Landing
          hasSavedProgress={sessionControls.hasSavedProgress}
          onStart={() => dispatch({ type: 'START_QUESTIONNAIRE' })}
          onBrowse={() => dispatch({ type: 'OPEN_OVERVIEW' })}
          onReset={sessionControls.clearLocalData}
        />
      ) : null}

      {state.phase !== PHASES.LANDING && state.phase !== PHASES.RESULTS ? (
        <Assessment
          state={state}
          dispatch={dispatch}
          sessionControls={sessionControls}
          aiLoading={aiStatus.loading}
          onAskAi={(request) => runAiRequest(request)}
        />
      ) : null}

      {state.phase === PHASES.RESULTS ? (
        <ResultsV2
          state={state}
          dispatch={dispatch}
          bankClient={bankClient}
        />
      ) : null}

      <AIConfigPanel
        open={configOpen}
        value={aiConfig}
        onApply={applyAiConfig}
        onClear={clearAiRuntime}
        onClose={() => {
          setPendingAiRequest(null);
          setConfigOpen(false);
        }}
      />
      <LocalDataPanel
        open={localDataOpen}
        state={state}
        aiConfigured={Boolean(aiConfig)}
        bankVersion={bankManifest.current}
        onClear={() => {
          clearAiRuntime();
          sessionControls.clearLocalData();
          setLocalDataOpen(false);
        }}
        onClose={() => setLocalDataOpen(false)}
      />
      <CandidateReview
        review={candidateReview}
        onConfirm={confirmCandidate}
        onClose={() => setCandidateReview(null)}
      />
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
        configureFormalModel(model);
        setBankState({ loading: false, error: null, manifest });
      })
      .catch((error) => {
        if (!active) return;
        setBankState({
          loading: false,
          error: error instanceof Error ? error.message : String(error),
          manifest: null,
        });
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  if (bankState.loading || bankState.error) {
    return <LoadingScreen error={bankState.error} onRetry={() => setAttempt((value) => value + 1)} />;
  }
  return <ReadyApp bankManifest={bankState.manifest} />;
}
