/** Casual deterrence only. These controls are not security boundaries and cannot hide client-side code or credentials. */
export function installInspectionDeterrents(): () => void {
  const stopMenu = (event: MouseEvent) => event.preventDefault();
  const stopShortcuts = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    const devtools = event.key === 'F12' || ((event.ctrlKey || event.metaKey) && event.shiftKey && ['i', 'j', 'c'].includes(key));
    const source = ((event.ctrlKey && !event.shiftKey) || (event.metaKey && (event.altKey || !event.shiftKey))) && key === 'u';
    if (devtools || source) { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  const detectTools = () => {
    const opened = Math.abs(window.outerWidth - window.innerWidth) > 180 || Math.abs(window.outerHeight - window.innerHeight) > 180;
    document.documentElement.dataset.picoInspector = opened ? 'open' : 'closed';
  };
  document.addEventListener('contextmenu', stopMenu, true);
  window.addEventListener('keydown', stopShortcuts, true);
  window.addEventListener('resize', detectTools);
  window.addEventListener('focus', detectTools);
  detectTools();
  return () => {
    document.removeEventListener('contextmenu', stopMenu, true);
    window.removeEventListener('keydown', stopShortcuts, true);
    window.removeEventListener('resize', detectTools);
    window.removeEventListener('focus', detectTools);
    delete document.documentElement.dataset.picoInspector;
  };
}
