/** Decorative, self-contained signal diagram. All essential navigation stays in HTML. */
export function PicoSignalCore() {
  return <div className="home-signal-core" aria-hidden="true">
    <svg viewBox="0 0 600 220" preserveAspectRatio="xMidYMid meet" focusable="false">
      <defs>
        <linearGradient id="pico-core-line" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--ds-muted)" stopOpacity=".28" />
          <stop offset=".5" stopColor="var(--accent)" stopOpacity=".8" />
          <stop offset="1" stopColor="var(--ds-muted)" stopOpacity=".28" />
        </linearGradient>
      </defs>
      <g className="signal-core-wires" fill="none" stroke="url(#pico-core-line)" strokeWidth="1.5">
        <path d="M 95 56 H 183 L 230 110 H 300" />
        <path d="M 95 164 H 183 L 230 110" />
        <path d="M 300 110 H 372 L 413 56 H 505" />
        <path d="M 372 110 L 413 164 H 505" />
        <path d="M 300 110 V 22" strokeDasharray="3 7" />
        <path d="M 300 110 V 198" strokeDasharray="3 7" />
      </g>
      <g className="signal-core-node signal-core-node-code">
        <rect x="30" y="32" width="110" height="48" rx="10" />
        <path d="m 68 51 -9 5 9 5 M 102 51 l 9 5 -9 5 M 90 46 l -7 20" />
      </g>
      <g className="signal-core-node signal-core-node-logic">
        <rect x="30" y="140" width="110" height="48" rx="10" />
        <path d="M 68 152 H 85 Q 103 152 103 164 Q 103 176 85 176 H 68 Z M 56 158 H 68 M 56 170 H 68 M 103 164 H 116" />
      </g>
      <g className="signal-core-node signal-core-node-flow">
        <rect x="458" y="32" width="110" height="48" rx="10" />
        <path d="M 513 42 L 530 56 L 513 70 L 496 56 Z" />
      </g>
      <g className="signal-core-node signal-core-node-cpu">
        <rect x="458" y="140" width="110" height="48" rx="10" />
        <rect x="497" y="151" width="32" height="26" rx="3" />
        <path d="M 491 156 H 497 M 491 164 H 497 M 491 172 H 497 M 529 156 H 535 M 529 164 H 535 M 529 172 H 535" />
      </g>
      <g className="signal-core-center">
        <rect x="256" y="66" width="88" height="88" rx="24" />
        <circle cx="300" cy="110" r="24" />
        <circle cx="300" cy="110" r="7" className="signal-core-center-dot" />
      </g>
      <g className="signal-core-points">
        <circle cx="183" cy="56" r="3" /><circle cx="183" cy="164" r="3" />
        <circle cx="413" cy="56" r="3" /><circle cx="413" cy="164" r="3" />
      </g>
    </svg>
  </div>;
}
