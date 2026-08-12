import React, { useMemo } from 'react';
import TermHelp from './TermHelp.jsx';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default function InlineTermText({ text, definitions = {} }) {
  const parts = useMemo(() => {
    if (!text) return [];
    const terms = Object.keys(definitions)
      .filter((term) => term && text.includes(term))
      .sort((left, right) => right.length - left.length);
    if (!terms.length) return [text];
    return text.split(new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'g')).filter(Boolean);
  }, [definitions, text]);

  return parts.map((part, index) => (
    definitions[part]
      ? <TermHelp key={`${part}-${index}`} term={part} explanation={definitions[part]} />
      : <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
  ));
}
