import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';

export function HomeGroup({ label, detail, children }: { label: string; detail: string; children: ReactNode }) {
  return <section className="home-group" aria-label={label}>
    <div className="home-group-head"><span className="home-group-label">{label}</span><span className="home-group-detail">{detail}</span></div>
    <div className="home-group-grid">{children}</div>
  </section>;
}

export function WorkspaceChoice({ icon, tag, title, description, onClick, onFocus, onMouseEnter, active }: { icon: ReactNode; tag?: string; title: string; description: string; onClick: () => void; onFocus?: () => void; onMouseEnter?: () => void; active?: boolean }) {
  return <button type="button" className={'compiler-choice'+(active?' is-selected':'')} onClick={onClick} onFocus={onFocus} onMouseEnter={onMouseEnter} aria-label={title}>
    <span className="compiler-choice-icon" aria-hidden="true">{icon}</span>
    <span className="compiler-choice-heading">
      <span className="compiler-choice-title"><h2>{title}</h2>{tag&&<code className="compiler-choice-tag" aria-hidden="true">{tag}</code>}</span>
      <span className="compiler-choice-description">{description}</span>
    </span>
    <ArrowUpRight className="compiler-choice-open-icon" size={18} aria-hidden="true" />
  </button>;
}
