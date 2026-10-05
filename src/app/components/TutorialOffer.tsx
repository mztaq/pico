import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';

export function TutorialOffer({ onStart, onDismiss }: { onStart: () => void; onDismiss: () => void }) {
  const startButton = useRef<HTMLButtonElement>(null);
  const dismissButton = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    startButton.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); onDismiss(); }
    if (event.key === 'Tab') {
      event.preventDefault();
      if (document.activeElement === startButton.current) dismissButton.current?.focus();
      else startButton.current?.focus();
    }
  }
  return <div className="tutorial-offer-backdrop">
    <div className="tutorial-offer" role="dialog" aria-modal="true" aria-labelledby="tutorial-offer-title" aria-describedby="tutorial-offer-description" onKeyDown={onKeyDown}>
      <h2 id="tutorial-offer-title">New to Pico?</h2>
      <p id="tutorial-offer-description">Take a quick tour of the workspace.</p>
      <div className="tutorial-offer-actions"><button ref={dismissButton} className="subtle-button" onClick={onDismiss}>Not now</button><button ref={startButton} className="primary-small" onClick={onStart}>Show tutorial</button></div>
    </div>
  </div>;
}
