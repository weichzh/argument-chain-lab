import React, { useState } from 'react';
import Assessment from './components/Assessment.jsx';
import { DilemmaIntro, DilemmaQuestion } from './components/DilemmaFlow.jsx';
import Header from './components/Header.jsx';
import Landing from './components/Landing.jsx';
import MethodModal from './components/MethodModal.jsx';
import ResultsV2 from './components/ResultsV2.jsx';
import { useSession } from './hooks/useSession.js';
import { PHASES } from './lib/engine.js';

export default function App() {
  const [state, dispatch] = useSession();
  const [methodOpen, setMethodOpen] = useState(false);

  const reset = () => {
    if (window.confirm('清除本轮全部回答并重新开始？')) dispatch({ type: 'RESET' });
  };

  return (
    <div className="app-root">
      <Header state={state} onMethod={() => setMethodOpen(true)} onReset={reset} />
      {state.phase === PHASES.LANDING ? <Landing onStart={() => dispatch({ type: 'START' })} onMethod={() => setMethodOpen(true)} /> : null}
      {[
        PHASES.STANCE,
        PHASES.DIRECTION,
        PHASES.ARGUMENT,
        PHASES.FACT,
        PHASES.BRIDGE,
        PHASES.DEPTH,
        PHASES.TERMINAL_CONFIRM,
        PHASES.STRESS,
        PHASES.CONFLICT,
        PHASES.BROKEN,
        PHASES.POLICY_COMPLETE,
      ].includes(state.phase) ? <Assessment state={state} dispatch={dispatch} /> : null}
      {state.phase === PHASES.DILEMMA_INTRO ? <DilemmaIntro state={state} dispatch={dispatch} /> : null}
      {state.phase === PHASES.DILEMMA ? <DilemmaQuestion state={state} dispatch={dispatch} /> : null}
      {state.phase === PHASES.RESULTS ? <ResultsV2 state={state} dispatch={dispatch} /> : null}
      <footer className="app-footer"><span>研究原型 0.5.0</span><span>本地保存 · 不输出政治身份 · 不用于高风险决策</span></footer>
      <MethodModal open={methodOpen} onClose={() => setMethodOpen(false)} />
    </div>
  );
}
