import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { onSoundChange, setSoundEnabled, soundEnabled } from '../sound';

/** Switch row used inside settings panels. */
export function SoundSetting() {
  const [enabled, setEnabled] = useState(soundEnabled);
  useEffect(() => onSoundChange(setEnabled), []);
  return <div className="sound-setting">
    <span className="sound-setting-icon" aria-hidden="true">{enabled ? <Volume2 size={15} /> : <VolumeX size={15} />}</span>
    <div><strong>Sound effects</strong><small>Keyboard clicks and louder feedback for actions and errors</small></div>
    <button className={`switch ${enabled ? 'checked' : ''}`} role="switch" aria-label="Sound effects" aria-checked={enabled} onClick={() => setSoundEnabled(!enabled)}><span /></button>
  </div>;
}

/** Compact icon button for headers. */
export function SoundButton() {
  const [enabled, setEnabled] = useState(soundEnabled);
  useEffect(() => onSoundChange(setEnabled), []);
  return <button className="toolbar-button sound-button" aria-pressed={enabled} aria-label={enabled ? 'Mute sound effects' : 'Turn on sound effects'} title={enabled ? 'Sound on' : 'Sound off'} onClick={() => setSoundEnabled(!enabled)}>
    {enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
  </button>;
}
