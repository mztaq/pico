import { useEffect, useId, useState } from 'react';
import type { Program } from '../../language/ast';
import { toMermaid } from '../../visual/flowchart';
interface Props { ast: Program | null; error?: string; }
export function FlowchartPanel({ ast, error }: Props) {
  const id = useId().replace(/:/g, '');
  const [svg, setSvg] = useState('');
  const [renderError, setRenderError] = useState('');
  useEffect(() => {
    let active = true;
    setSvg(''); setRenderError('');
    if (!ast) return () => { active = false; };
    void (async () => {
      try {
        const { default: mermaid } = await import('mermaid');
        if (!active) return;
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'dark', flowchart: { curve: 'basis', htmlLabels: false, nodeSpacing: 34, rankSpacing: 42 }, themeVariables: { background: '#111318', primaryColor: '#1a1d28', primaryTextColor: '#ececf4', primaryBorderColor: '#45495a', lineColor: '#858b9e', secondaryColor: '#27233c', tertiaryColor: '#14161d', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '13px' } });
        const { svg: rendered } = await mermaid.render(`pico-flow-${id}`, toMermaid(ast));
        if (active) setSvg(rendered);
      } catch { if (active) setRenderError('This flowchart could not be drawn. Try simplifying the program structure.'); }
    })();
    return () => { active = false; };
  }, [ast, id]);
  if (error) return <div className="panel-empty"><span className="empty-icon">◇</span><strong>Fix the syntax to see the flowchart</strong><p>{error}</p></div>;
  if (!ast) return <div className="panel-empty"><span className="empty-icon">◇</span><strong>Start with a Cambridge example</strong><p>Your program flow will appear here.</p></div>;
  if (renderError) return <div className="panel-empty"><strong>Flowchart unavailable</strong><p>{renderError}</p></div>;
  return <div className="flowchart-canvas">{svg ? <div className="mermaid-output" dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="diagram-loading"><span className="spinner" /> Drawing your program…</div>}</div>;
}
