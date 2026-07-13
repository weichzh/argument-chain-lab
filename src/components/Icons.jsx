import React from 'react';

const Icon = ({ children, size = 20, className = '', ...props }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    height={size}
    viewBox="0 0 24 24"
    width={size}
    {...props}
  >
    {children}
  </svg>
);

export const ArrowRight = (props) => (
  <Icon {...props}><path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></Icon>
);
export const ArrowLeft = (props) => (
  <Icon {...props}><path d="M19 12H5m5 5-5-5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></Icon>
);
export const Check = (props) => (
  <Icon {...props}><path d="m5 12 4 4L19 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></Icon>
);
export const X = (props) => (
  <Icon {...props}><path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" /></Icon>
);
export const Help = (props) => (
  <Icon {...props}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" /><path d="M9.8 9.1a2.4 2.4 0 0 1 4.65.8c0 1.8-2.45 2-2.45 3.7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /><path d="M12 17.2h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" /></Icon>
);
export const ChevronDown = (props) => (
  <Icon {...props}><path d="m7 10 5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></Icon>
);
export const Download = (props) => (
  <Icon {...props}><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 18v2h14v-2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></Icon>
);
export const Rotate = (props) => (
  <Icon {...props}><path d="M4 8V4m0 0h4M4 4l3.2 3.2A7.5 7.5 0 1 1 5 15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></Icon>
);
export const Book = (props) => (
  <Icon {...props}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Zm16 0A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" /></Icon>
);
export const Alert = (props) => (
  <Icon {...props}><path d="M12 4 3.5 19h17L12 4Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" /><path d="M12 9v4m0 3h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" /></Icon>
);
export const LinkIcon = (props) => (
  <Icon {...props}><path d="M9.5 14.5 14.5 9m-7.7 8.2-1 1a3.4 3.4 0 0 1-4.8-4.8l3.2-3.2A3.4 3.4 0 0 1 9 10m6-1a3.4 3.4 0 0 1 4.8-3.2l1-1a3.4 3.4 0 0 1 4.8 4.8l-3.2 3.2A3.4 3.4 0 0 1 15 14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" transform="translate(-2.8 0)" /></Icon>
);
export const Scale = (props) => (
  <Icon {...props}><path d="M12 4v16M5 7h14M7 7l-4 7h8L7 7Zm10 0-4 7h8l-4-7ZM8 20h8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" /></Icon>
);
export const Eye = (props) => (
  <Icon {...props}><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" /><circle cx="12" cy="12" r="2.7" stroke="currentColor" strokeWidth="1.6" /></Icon>
);

/* Semantic aliases used by the dialogue interface. */
export const ArrowRightIcon = ArrowRight;
export const ArrowLeftIcon = ArrowLeft;
export const CheckIcon = Check;
export const CloseIcon = X;
export const DownloadIcon = Download;
export const BookIcon = Book;
export const AlertIcon = Alert;
export const ScaleIcon = Scale;
export const RestartIcon = Rotate;
export const ChevronDownIcon = ChevronDown;

export const SettingsIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M19.1 13.5v-3l-2-.7a7.8 7.8 0 0 0-.6-1.4l.9-1.9-2.1-2.1-1.9.9a7.8 7.8 0 0 0-1.4-.6l-.7-2h-3l-.7 2a7.8 7.8 0 0 0-1.4.6l-1.9-.9-2.1 2.1.9 1.9a7.8 7.8 0 0 0-.6 1.4l-2 .7v3l2 .7c.15.5.35 1 .6 1.4l-.9 1.9 2.1 2.1 1.9-.9c.45.25.9.45 1.4.6l.7 2h3l.7-2c.5-.15 1-.35 1.4-.6l1.9.9 2.1-2.1-.9-1.9c.25-.45.45-.9.6-1.4l2-.7Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.15" transform="translate(1.45 0) scale(.88)" />
  </Icon>
);

export const DatabaseIcon = (props) => (
  <Icon {...props}>
    <ellipse cx="12" cy="5" rx="7" ry="3" stroke="currentColor" strokeWidth="1.7" />
    <path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" stroke="currentColor" strokeWidth="1.7" />
  </Icon>
);

export const FactIcon = (props) => (
  <Icon {...props}>
    <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
  </Icon>
);

export const BridgeIcon = (props) => (
  <Icon {...props}>
    <path d="M3 18h18M5 18V9m14 9V9M5 12c2.1-4 4.4-6 7-6s4.9 2 7 6M8 18v-4m8 4v-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
  </Icon>
);

export const QuestionIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
    <path d="M9.7 9.2a2.5 2.5 0 0 1 4.8.8c0 1.9-2.5 2.1-2.5 4M12 17.5h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </Icon>
);

export const LayersIcon = (props) => (
  <Icon {...props}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
    <path d="m3 12 9 5 9-5M3 16l9 5 9-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
  </Icon>
);

export const ExternalLinkIcon = (props) => (
  <Icon {...props}>
    <path d="M14 4h6v6M20 4l-9 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
  </Icon>
);

export const InfoIcon = Help;
export const RefreshIcon = Rotate;
export const LockIcon = (props) => (
  <Icon {...props}>
    <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8 10V7a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.7" />
  </Icon>
);
export const ChainIcon = LinkIcon;
