import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { workspaceFromLocation } from '../workspace-deeplink';
import { buildWorkspaceMenu, type WorkspaceMenuModel } from './workspace-menu-actions';
import './workspace-context-menu.css';

interface MenuState extends WorkspaceMenuModel {
  x: number;
  y: number;
}

const isEditable = (target: Element): boolean =>
  Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), .cm-editor, [role="textbox"]'));

const isOverlay = (target: Element): boolean =>
  Boolean(target.closest('[role="dialog"], [aria-modal="true"], .pico-offline-overlay, .pico-offline-modal, [inert]'));

/**
 * App-level right-click options. Text editors keep their native clipboard and
 * spellcheck menu, and disabled/inert controls cannot be bypassed.
 */
export function WorkspaceContextMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [active, setActive] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = () => setMenu(null);

  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest('#root') || isEditable(target) || isOverlay(target)) return;
      const scope = target.closest(
        '.pico-app, .flow-builder, .logic-app, .cpu-app, .binary-app, .storm-app, ' +
        '.pico-home, .learning-hub',
      );
      if (!scope) return;

      const workspace = workspaceFromLocation(window.location.pathname, window.location.search);
      // Older desktop shells render App at /. Their current workspace still
      // has a unique root class even if no deep-link was written.
      const inferred = workspace ?? (
        scope.matches('.flow-builder') ? 'flowchart' :
        scope.matches('.logic-app') ? 'logic' :
        scope.matches('.cpu-app') ? 'cpu' :
        scope.matches('.binary-app') ? 'binary' :
        scope.matches('.storm-app') ? 'traffic' :
        scope.matches('.pico-games') ? 'games' :
        scope.matches('.learning-hub') ? 'learn' : null
      );
      const model = buildWorkspaceMenu(inferred, target);
      if (!model.actions.length) return;
      event.preventDefault();
      event.stopPropagation();
      setActive(Math.max(0, model.actions.findIndex(item => !item.disabled)));
      setMenu({ ...model, x: event.clientX, y: event.clientY });
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) close();
    };
    const onScroll = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) close();
    };
    const onBlur = () => close();
    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('blur', onBlur);
    window.addEventListener('popstate', onBlur);
    return () => {
      document.removeEventListener('contextmenu', onContextMenu, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('popstate', onBlur);
    };
  }, []);

  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return;
    const element = menuRef.current;
    const rect = element.getBoundingClientRect();
    const padding = 8;
    element.style.left = Math.max(padding, Math.min(menu.x, window.innerWidth - rect.width - padding)) + 'px';
    element.style.top = Math.max(padding, Math.min(menu.y, window.innerHeight - rect.height - padding)) + 'px';
    element.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
  }, [menu]);

  if (!menu) return null;

  const execute = (index: number) => {
    const action = menu.actions[index];
    if (!action || action.disabled) return;
    close();
    action.run();
  };
  const move = (direction: number) => {
    const count = menu.actions.length;
    for (let offset = 1; offset <= count; offset++) {
      const candidate = (active + direction * offset + count * (offset + 1)) % count;
      if (!menu.actions[candidate].disabled) {
        setActive(candidate);
        menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[candidate]?.focus();
        break;
      }
    }
  };

  return createPortal(
    <div className="pico-context-menu" ref={menuRef} role="menu" aria-label={menu.title + ' options'}
      style={{ left: menu.x, top: menu.y }}
      onContextMenu={event => event.preventDefault()}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); close(); }
        else if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
        else if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          const indexes = menu.actions.map((action, index) => !action.disabled ? index : -1).filter(index => index >= 0);
          const index = event.key === 'Home' ? indexes[0] : indexes[indexes.length - 1];
          if (index !== undefined) {
            setActive(index);
            menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[index]?.focus();
          }
        }
        else if (event.key === 'Tab') close();
      }}>
      <div className="pico-context-title">{menu.title}</div>
      <div className="pico-context-list">
        {menu.actions.map((action, index) => {
          const Icon = action.icon;
          const separator = index > 0 && action.group !== menu.actions[index - 1].group;
          return <div key={action.group + ':' + action.label} className={separator ? 'pico-context-separated' : undefined}>
            <button type="button" role="menuitem" disabled={action.disabled}
              className={'pico-context-action' + (action.destructive ? ' pico-context-destructive' : '')}
              tabIndex={active === index ? 0 : -1}
              onFocus={() => setActive(index)}
              onClick={() => execute(index)}>
              <Icon size={15} aria-hidden="true" strokeWidth={1.8}/><span>{action.label}</span>
            </button>
          </div>;
        })}
      </div>
    </div>,
    document.body,
  );
}
