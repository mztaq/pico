import { expect, it } from 'vitest';
import { inputEasterEgg } from './inputEasterEgg';

it.each([
  ['amar', 'The dev who engineered me day and night ☾'],
  ['mustaqim', 'The soul who unleashed me to the World Wide Web 🌏︎'],
])('preserves the exact %s message and recognises case and surrounding whitespace', (name, message) => {
  expect(inputEasterEgg(name)).toBe(message);
  expect(inputEasterEgg(`  ${name.toUpperCase()}  `)).toBe(message);
});

it.each([
  ['Boyle', 'The Computer Science teacher who backed my creators and their work 🕮'],
  ['Fore', 'The head of Computer Science and ICT at our school 🖳'],
])('recognises the name and title variants for %s', (name, message) => {
  for (const prefix of ['', 'Mr ', 'mr ', 'Mr.', 'mr. ', 'MR. ', 'Mr', ' Mr .   ']) {
    for (const spelling of [name, name.toLowerCase(), name.toUpperCase()]) {
      expect(inputEasterEgg(`${prefix}${spelling}  `)).toBe(message);
    }
  }
});

it.each(['Boyles', 'Foreman', 'Mr Boyle is here', 'Hello Fore', 'Mr Amar', 'Mr Mustaqim', '', 'Amar and Mustaqim'])('does not match unrelated input: %s', value => {
  expect(inputEasterEgg(value)).toBeUndefined();
});
