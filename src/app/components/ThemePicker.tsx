import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { THEMES, type PicoTheme } from '../themes';

interface ThemePickerProps { value: string; onChange: (id: string) => void; }

/** A searchable gallery of every editor theme, each shown with its own token colours. */
export function ThemePicker({ value, onChange }: ThemePickerProps) {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching = THEMES.filter(theme => !needle || theme.name.toLowerCase().includes(needle) || theme.id.includes(needle));
    return [
      { label: 'Dark themes', themes: matching.filter(theme => theme.appearance === 'dark') },
      { label: 'Light themes', themes: matching.filter(theme => theme.appearance === 'light') },
    ].filter(group => group.themes.length > 0);
  }, [query]);

  return <div className="theme-picker">
    <div className="theme-picker-head">
      <span>Editor theme</span>
      <small>{THEMES.length} themes · syntax colours included</small>
    </div>
    <label className="theme-search">
      <Search size={12} />
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search themes" aria-label="Search editor themes" />
    </label>
    <div className="theme-list" role="listbox" aria-label="Editor theme">
      {groups.map(group => <div className="theme-group" key={group.label}>
        <span className="theme-group-label">{group.label}</span>
        {group.themes.map(theme => <button
          key={theme.id}
          role="option"
          aria-selected={theme.id === value}
          className={`theme-option ${theme.id === value ? 'active' : ''}`}
          title={`${theme.name} · ${theme.appearance}`}
          onClick={() => onChange(theme.id)}
        >
          <ThemeSwatch theme={theme} />
          <span className="theme-option-name">{theme.name}</span>
          {theme.id === value && <Check size={13} className="theme-option-check" />}
        </button>)}
      </div>)}
      {groups.length === 0 && <p className="theme-empty">No theme matches “{query}”.</p>}
    </div>
  </div>;
}

function ThemeSwatch({ theme }: { theme: PicoTheme }) {
  return <span className="theme-swatch" style={{ background: theme.bg, borderColor: theme.ui.border }} aria-hidden="true">
    <i style={{ background: theme.syntax.keyword }} />
    <i style={{ background: theme.syntax.type }} />
    <i style={{ background: theme.syntax.string }} />
    <i style={{ background: theme.syntax.number }} />
    <i style={{ background: theme.accent }} />
  </span>;
}