import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';

export function HomeGroup({ label, detail, children }: { label: string; detail: string; children: ReactNode }) {
  return <section className="home-group" aria-label={label}>
    <div className="home-group-head">
      <span className="home-group-label">{label}</span>
      <span className="home-group-detail">{detail}</span>
    </div>
    <div className="home-group-grid">{children}</div>
  </section>;
}

export function WorkspaceChoice({ icon, tag, title, description, onClick, children }: { icon: ReactNode; tag?: string; title: string; description: string; onClick: () => void; children: ReactNode }) {
  return <button type="button" className="compiler-choice" onClick={onClick}>
    <div className="compiler-choice-head">
      <span className="compiler-choice-icon" aria-hidden="true">{icon}</span>
      <span className="compiler-choice-heading"><span className="compiler-choice-title"><h2>{title}</h2>{tag && <code className="compiler-choice-tag" aria-hidden="true">{tag}</code>}</span><span className="compiler-choice-description">{description}</span></span>
      <ArrowUpRight className="compiler-choice-open-icon" size={19} aria-hidden="true" />
    </div>
    <div className="compiler-choice-stage" aria-hidden="true">
      <div className="compiler-choice-stage-bar"><span className="compiler-choice-stage-indicator" /><span>{tag ? `main${tag}` : title === 'Flowchart Builder' ? 'flowchart' : title === 'Logic Sim' ? 'circuit' : 'architecture'}</span><span className="compiler-choice-stage-mode">PREVIEW</span></div>
      <div className="compiler-choice-stage-content">{children}</div>
    </div>
    <div className="compiler-choice-footer"><span>Open workspace</span><ArrowUpRight size={15} aria-hidden="true" /></div>
  </button>;
}
