export interface BugCase { args: unknown[]; expected: unknown; }
export interface BugQuestion {
  id: string; title: string; difficulty: 'Beginner' | 'Easy'; topic: string;
  description: string; starter: string; functionName: string; cases: BugCase[];
  hints: string[]; solution: string; explanation: string;
}

export const bugQuestions: BugQuestion[] = [
  {
    id: 'positive-total', title: 'Add the numbers', difficulty: 'Beginner', topic: 'Functions and arithmetic',
    description: 'This function should return the total of all numbers in a list. It currently starts from the wrong value. Fix the bug so empty lists and ordinary lists both work.',
    starter: 'def total(numbers):\n    result = 1\n    for number in numbers:\n        result += number\n    return result', functionName: 'total',
    cases: [{args: [[2, 3, 5]], expected: 10}, {args: [[]], expected: 0}, {args: [[-4, 4]], expected: 0}],
    hints: ['What value should you get before adding any numbers?', 'The starting value must be the identity for addition.'],
    solution: 'def total(numbers):\n    result = 0\n    for number in numbers:\n        result += number\n    return result',
    explanation: 'A sum starts at 0. Adding every item to 0 leaves the first item unchanged, and an empty list correctly produces 0.',
  },
  {
    id: 'count-vowels', title: 'Count the vowels', difficulty: 'Easy', topic: 'Strings and loops',
    description: 'Count the vowels in a piece of text. The function should treat uppercase and lowercase letters equally and count repeated vowels.',
    starter: 'def count_vowels(text):\n    vowels = "aeiou"\n    count = 0\n    for letter in text:\n        if letter in vowels:\n            count += 1\n    return count', functionName: 'count_vowels',
    cases: [{args: ['Education'], expected: 5}, {args: ['rhythm'], expected: 0}, {args: ['Aaa'], expected: 3}],
    hints: ['The membership check only looks for lowercase letters.', 'Normalize the text once before the loop.'],
    solution: 'def count_vowels(text):\n    vowels = "aeiou"\n    count = 0\n    for letter in text.lower():\n        if letter in vowels:\n            count += 1\n    return count',
    explanation: 'Converting the input to lowercase makes one membership check handle both cases. Each matching character increments the count, including repeats.',
  },
  {
    id: 'largest-number', title: 'Find the largest', difficulty: 'Easy', topic: 'Lists and comparisons',
    description: 'Return the largest number in a non-empty list. The current comparison misses values that should replace the current largest.',
    starter: 'def largest(numbers):\n    best = numbers[0]\n    for number in numbers[1:]:\n        if number < best:\n            best = number\n    return best', functionName: 'largest',
    cases: [{args: [[3, 9, 2]], expected: 9}, {args: [[-8, -2, -5]], expected: -2}, {args: [[4]], expected: 4}],
    hints: ['Compare each number with the current best.', 'When should best be replaced: when number is smaller or larger?'],
    solution: 'def largest(numbers):\n    best = numbers[0]\n    for number in numbers[1:]:\n        if number > best:\n            best = number\n    return best',
    explanation: 'Replace the saved value only when a larger number is found. Starting with the first item also handles lists of negative values.',
  },
];

export function buildCheckProgram(source: string, question: BugQuestion): string {
  const cases = JSON.stringify(question.cases);
  return `${source}\n\nimport json as _pico_json\n_pico_cases = ${cases}\n_pico_results = []\nfor _pico_case in _pico_cases:\n    try:\n        _pico_actual = ${question.functionName}(*_pico_case["args"])\n        _pico_results.append(_pico_actual == _pico_case["expected"])\n    except Exception:\n        _pico_results.append(False)\nprint("PICO_CHECK:" + _pico_json.dumps(_pico_results))\n`;
}
