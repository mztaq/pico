import type { ReactNode } from 'react';

export function HomeGroup({ label, detail, children }: { label: string; detail: string; children: ReactNode }) {
  return <section className="home-group" aria-label={label}>
    <div className="home-group-head"><span className="home-group-label">{label}</span><span className="home-group-detail">{detail}</span></div>
    <div className="home-group-grid">{children}</div>
  </section>;
}

export function WorkspaceChoice({ icon, tag, title, description, onClick, children }: { icon: ReactNode; tag?: string; title: string; description: string; onClick: () => void; children: ReactNode }) {
  return <button className="compiler-choice" onClick={onClick}>
    <div className="compiler-choice-stage" aria-hidden="true">{children}</div>
    <div className="compiler-choice-copy">
      <div className="compiler-choice-title"><i className="compiler-choice-icon" aria-hidden="true">{icon}</i><h2>{title}</h2>{tag && <code className="compiler-choice-tag" aria-hidden="true">{tag}</code>}</div>
      <p>{description}</p>
    </div>
  </button>;
}
