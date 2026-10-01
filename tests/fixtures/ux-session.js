import { model } from '../../scripts/current-bank.mjs';
import * as engine from '../../src/lib/decisionEngine.js';

// Synthetic branch-coverage input, not a person's politics and never uploaded.
export const createUXFixture = () => {
  let state = engine.startSession(model, engine.createSession(model));
  for (let index = 0; index < model.product.defaultPolicyIds.length; index++) {
    let guard = 0;
    while (state.phase !== engine.PHASES.POLICY_DONE) {
      if (++guard > 65) throw new Error(`Fixture did not terminate at ${state.currentPolicyId}`);
      const question = engine.getQuestion(model, state);
      let option;
      if (question.kind === 'policy_decision') option = ['no', 'no', 'uncertain', 'yes', 'no', 'no', 'no', 'no'][index];
      else if (question.kind === 'revision_test') option = index === 0 ? 'reject'
        : index >= 6 ? 'uncertain'
        : state.diagnosticIndex >= (index === 1 ? 3 : index === 5 ? 1 : 0) ? 'accept' : 'reject';
      else if (question.kind === 'reason_choice') option = question.options.find(item => model.reasons[item.id]).id;
      else if (question.kind === 'assumption_check') option = [1, 4].includes(index) ? 'save_unchecked' : 'accept';
      else if (question.kind === 'rule_check') option = 'accept';
      else if (question.kind === 'why_or_stop') option = 'stop_here';
      else if (question.kind === 'stress_test') option = 'apply';
      else if (question.kind === 'counter_reason_choice') option = index === 5 ? question.options[0].id : 'none';
      else if (question.kind === 'counter_impact') option = 'weaken';
      else throw new Error(`Unsupported fixture branch ${question.kind}`);
      state = engine.answer(model, state, option);
    }
    state = engine.answer(model, state, index === model.product.defaultPolicyIds.length - 1 ? 'results' : 'next');
  }
  return state;
};
