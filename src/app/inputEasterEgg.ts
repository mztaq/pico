const amar = 'The gentleman who constructed me from the ground up';
const mustaqim = 'The gentleman who released me to the World Wide Web';
const teacher = 'Hello, He is my computer science teacher';
const head = 'Hello, He is the head of computer science and ICT';

const messages = new Map([
  ['amar', amar], ['mustaqim', mustaqim],
  ['mr.boyle', teacher], ['mr. boyle', teacher], ['boyle', teacher],
  ['fore', head], ['mr.fore', head], ['mr. fore', head],
]);

/** Display-only lookup. The original input value is still sent to the worker. */
export function inputEasterEgg(value: string): string | undefined {
  return messages.get(value.trim().toLowerCase().replace(/\s+/g, ' '));
}
