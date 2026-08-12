import React from 'react';
import { ArrowRight } from 'lucide-react';

export default function QuestionCard({ question, context, onAnswer, children }) {
  return (
    <section className="v4-question-card" aria-labelledby="current-question">
      <div className="v4-question-context">{context}</div>
      <header>
        <h1 id="current-question">{question.title}</h1>
        {question.statement ? <p>{question.statement}</p> : null}
        {question.explanation ? <small>{question.explanation}</small> : null}
      </header>
      {children}
      {question.options?.length ? (
        <div className="v4-choice-list">
          {question.options.map((option) => (
            <button type="button" key={option.id} onClick={() => onAnswer(option.id)}>
              <span>
                <strong>{option.label}</strong>
                {option.description ? <small>{option.description}</small> : null}
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
