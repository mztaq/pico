const amar = 'The dev who engineered me day and night ☾';
const mustaqim = 'The soul who unleashed me to the World Wide Web 🌏︎';
const teacher = 'The Computer Science teacher who backed my creators and their work';
const head = 'The head of Computer Science and ICT at our school';

const messages = new Map([
  ['amar', amar], ['mustaqim', mustaqim],
  ['boyle', teacher], ['fore', head],
]);

/** Display-only lookup. The original input value is still sent to the worker. */
export function inputEasterEgg(value: string): string | undefined {
  const name = value.trim().toLowerCase().replace(/\s+/g, ' ');
  const teacherName = /^(?:mr\s*\.?\s*)?(boyle|fore)$/.exec(name)?.[1];
  return messages.get(teacherName ?? name);
}
