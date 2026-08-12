import React, { useEffect, useRef, useState } from 'react';
import { CircleHelp } from 'lucide-react';

export default function TermHelp({ term, explanation }) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const buttonRef = useRef(null);
  const open = hovered || pinned;

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event.key !== 'Escape') return;
      setHovered(false);
      setPinned(false);
      buttonRef.current?.focus();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  return (
    <span className="term-help" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        onClick={() => setPinned((value) => !value)}
      >
        {term}<CircleHelp size={14} aria-hidden="true" />
      </button>
      {open ? <span className="term-popover" role="tooltip">{explanation}</span> : null}
    </span>
  );
}
