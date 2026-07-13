import React, { useMemo, useState, useEffect } from 'react';
import Assessment from './components/Assessment.jsx';
import AIConfigPanel from './components/AIConfigPanel.jsx';
import CandidateReview from './components/CandidateReview.jsx';
import Header from './components/Header.jsx';
import Landing from './components/Landing.jsx';
import LocalDataPanel from './components/LocalDataPanel.jsx';
import MethodModal from './components/MethodModal.jsx';
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
import { mergeCandidateIntoOverlay, validateArgumentCandidate } from './lib/sessionOverlay.js';

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
  const [methodOpen, setMethodOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [localDataOpen, setLocalDataOpen] = useState(false);
  const [aiConfig, setAiConfig] = useState(null);
  const [aiStatus, setAiStatus] = useState({ loading: false, error: null });
  const [candidateReview, setCandidateReview] = useState(null);
  const [pendingAiRequest, setPendingAiRequest] = useState(null);

  const bankClient = useMemo(() => new HttpBankClient({
    endpoint: import.meta.env.VITE_BANK_ENDPOINT || window.__ARGUMENT_CHAIN_BANK_ENDPOINT__ || '',
  }), []);

  const runAiRequest = async (request, config = aiConfig) => {
    if (!config) {
      setPendingAiRequest(request);
      setConfigOpen(true);
      return;
    }
    setAiStatus({ loading: true, error: null });
    try {
      const candidate = await proposeWithPiAgent({
        config,
        userText: request.text,
        scope: request.scope,
        context: buildAiContext(state),
      });
      setCandidateReview({ candidate, scope: request.scope, draftKey: request.draftKey });
      setPendingAiRequest(null);
      setAiStatus({ loading: false, error: null });
    } catch (error) {
      setAiStatus({ loading: false, error: error instanceof Error ? error.message : String(error) });
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
    const validation = validateArgumentCandidate(candidate, candidateReview.scope);
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

  const reset = () => {
    setAiConfig(null);
    dispatch({ type: 'RESET' });
  };

  return (
    <div className="app-root">
      <Header
        state={state}
        aiConfigured={Boolean(aiConfig)}
        onMethod={() => setMethodOpen(true)}
        onConfig={() => setConfigOpen(true)}
        onLocalData={() => setLocalDataOpen(true)}
      />

      {aiStatus.error ? (
        <div className="global-alert" role="alert">
          <span>{aiStatus.error}</span>
          <button type="button" onClick={() => setAiStatus((value) => ({ ...value, error: null }))}>关闭</button>
        </div>
      ) : null}

      {state.phase === PHASES.LANDING ? (
        <Landing
          aiLoading={aiStatus.loading}
          onStartBank={() => dispatch({ type: 'START' })}
          onStartCustom={(request) => runAiRequest(request)}
        />
      ) : null}

      {state.phase !== PHASES.LANDING && state.phase !== PHASES.RESULTS ? (
        <Assessment
          state={state}
          dispatch={dispatch}
          aiLoading={aiStatus.loading}
          onAskAi={(request) => runAiRequest(request)}
        />
      ) : null}

      {state.phase === PHASES.RESULTS ? (
        <ResultsV2
          state={state}
          dispatch={dispatch}
          bankClient={bankClient}
          onReset={reset}
        />
      ) : null}

      <MethodModal open={methodOpen} onClose={() => setMethodOpen(false)} />
      <AIConfigPanel
        open={configOpen}
        value={aiConfig}
        onApply={applyAiConfig}
        onClear={() => setAiConfig(null)}
        onClose={() => setConfigOpen(false)}
      />
      <LocalDataPanel
        open={localDataOpen}
        state={state}
        aiConfigured={Boolean(aiConfig)}
        bankVersion={bankManifest.current}
        onClear={() => {
          setAiConfig(null);
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
