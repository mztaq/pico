import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';

type WorkspaceKind = 'pseudocode' | 'python' | 'flowchart' | 'logic' | 'cpu';

export function HomeGroup({ label, detail, children }: { label: string; detail: string; children: ReactNode }) {
  return <section className="home-group" aria-label={label}>
    <div className="home-group-head">
      <span className="home-group-label">{label}</span>
      <span className="home-group-detail">{detail}</span>
    </div>
    <div className="home-group-grid">{children}</div>
  </section>;
}

/** The entire card is one accessible navigation button; its miniature example is illustrative. */
export function WorkspaceChoice({ kind, icon, tag, title, description, onClick, children }: {
  kind: WorkspaceKind;
  icon: ReactNode;
  tag?: string;
  title: string;
  description: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return <button type="button" className={`compiler-choice compiler-choice--${kind}`} onClick={onClick}>
    <span className="compiler-choice-stage" aria-hidden="true">{children}</span>
    <span className="compiler-choice-copy">
      <span className="compiler-choice-title">
        <span className="compiler-choice-icon" aria-hidden="true">{icon}</span>
        <span className="compiler-choice-name">{title}</span>
        {tag && <code className="compiler-choice-tag" aria-hidden="true">{tag}</code>}
        <ArrowUpRight className="compiler-choice-arrow" size={17} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="compiler-choice-description">{description}</span>
    </span>
  </button>;
}
