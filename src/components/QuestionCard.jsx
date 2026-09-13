import React from 'react';
import { ArrowRight } from 'lucide-react';
import InlineTermText from './InlineTermText.jsx';

export default function QuestionCard({
  question,
  context,
  onAnswer,
  termDefinitions = {},
  beforeQuestion = null,
  afterQuestion = null,
}) {
  return (
    <section tabIndex={-1} className="v4-question-card" aria-labelledby="current-question">
      <div className="v4-question-context">{context}</div>
      {beforeQuestion}
      {question.principle ? <aside className="stress-principle"><strong>正在检查的原则</strong><p><InlineTermText text={question.principle} definitions={termDefinitions} /></p></aside> : null}
      <header>
        <h1 id="current-question"><InlineTermText text={question.title} definitions={termDefinitions} /></h1>
        {question.statement ? <p><InlineTermText text={question.statement} definitions={termDefinitions} /></p> : null}
        {question.explanation ? <small><InlineTermText text={question.explanation} definitions={termDefinitions} /></small> : null}
      </header>
      {question.options?.length ? (
        <div className="v4-choice-list">
          {question.options.map((option) => (
            <button
              type="button"
              key={option.id}
              aria-labelledby={`question-option-${option.id}`}
              aria-describedby={option.description ? `question-option-${option.id}-description` : undefined}
              onClick={() => onAnswer(option.id)}
            >
              <span>
                <strong id={`question-option-${option.id}`}>{option.label}</strong>
                {option.description ? <small id={`question-option-${option.id}-description`}>{option.description}</small> : null}
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}
      {afterQuestion}
    </section>
  );
}
