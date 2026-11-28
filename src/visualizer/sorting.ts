export type SortAlgorithm = 'bubble' | 'selection' | 'insertion';
export type AlgorithmId = 'linear-search' | 'bubble' | 'total' | 'count' | 'maximum' | 'minimum' | 'average' | 'selection' | 'insertion';

export interface AlgorithmFrame {
  values: number[];
  active: number[];
  sorted: number[];
  label: string;
  variables: string[];
}

export interface AlgorithmInfo {
  name: string;
  description: string;
  complexity: string;
  python: string;
}

export const ALGORITHM_INFO: Record<AlgorithmId, AlgorithmInfo> = {
  'linear-search': { name: 'Linear search', description: 'Check each item in order until the target is found or the list ends.', complexity: 'O(n) time · O(1) space', python: 'for index in range(len(data)):\n    if data[index] == target:\n        return index\nreturn -1' },
  bubble: { name: 'Bubble sort', description: 'Compare neighboring values and move the larger one toward the end.', complexity: 'O(n²) time · O(1) space', python: 'for end in range(len(data) - 1, 0, -1):\n    for index in range(end):\n        if data[index] > data[index + 1]:\n            data[index], data[index + 1] = data[index + 1], data[index]' },
  total: { name: 'Totalling', description: 'Add each item to a running total, starting from zero.', complexity: 'O(n) time · O(1) space', python: 'total = 0\nfor value in data:\n    total = total + value' },
  count: { name: 'Counting', description: 'Visit every item and increase a counter when it meets a condition.', complexity: 'O(n) time · O(1) space', python: 'count = 0\nfor value in data:\n    if value >= threshold:\n        count = count + 1' },
  maximum: { name: 'Finding maximum', description: 'Keep the largest value seen so far while scanning the list.', complexity: 'O(n) time · O(1) space', python: 'largest = data[0]\nfor index in range(1, len(data)):\n    if data[index] > largest:\n        largest = data[index]' },
  minimum: { name: 'Finding minimum', description: 'Keep the smallest value seen so far while scanning the list.', complexity: 'O(n) time · O(1) space', python: 'smallest = data[0]\nfor index in range(1, len(data)):\n    if data[index] < smallest:\n        smallest = data[index]' },
  average: { name: 'Finding average', description: 'Add all values, then divide the total by the number of items.', complexity: 'O(n) time · O(1) space', python: 'total = 0\nfor value in data:\n    total = total + value\naverage = total / len(data)' },
  selection: { name: 'Selection sort · extra', description: 'Find the smallest remaining value and place it in the next open position.', complexity: 'O(n²) time · O(1) space', python: 'for start in range(len(data)):\n    smallest = start\n    for index in range(start + 1, len(data)):\n        if data[index] < data[smallest]:\n            smallest = index\n    data[start], data[smallest] = data[smallest], data[start]' },
  insertion: { name: 'Insertion sort · extra', description: 'Take each value and slide it left into its correct place in the sorted section.', complexity: 'O(n²) time · O(1) space', python: 'for index in range(1, len(data)):\n    value = data[index]\n    position = index - 1\n    while position >= 0 and data[position] > value:\n        data[position + 1] = data[position]\n        position = position - 1\n    data[position + 1] = value' },
};

export function createAlgorithmFrames(input: readonly number[], algorithm: AlgorithmId, target = 50): AlgorithmFrame[] {
  if (algorithm === 'bubble' || algorithm === 'selection' || algorithm === 'insertion') {
    return createSortFrames(input, algorithm).map(frame => ({ ...frame, variables: [] }));
  }

  const values = [...input];
  const frames: AlgorithmFrame[] = [{ values: [...values], active: [], sorted: [], label: 'Ready to begin.', variables: [] }];
  const add = (active: number[], sorted: number[], label: string, variables: string[]) => frames.push({ values: [...values], active, sorted: [...sorted], label, variables });
  const visited = new Set<number>();

  if (algorithm === 'linear-search') {
    let found = -1;
    for (let index = 0; index < values.length; index++) {
      visited.add(index);
      add([index], [...visited], `Check item ${index + 1}: ${values[index]} ${values[index] === target ? 'matches' : 'does not match'} ${target}.`, [`index = ${index}`, `target = ${target}`]);
      if (values[index] === target) { found = index; break; }
    }
    add(found < 0 ? [] : [found], found < 0 ? [...visited] : [found], found < 0 ? `${target} was not found in the list.` : `Found ${target} at position ${found + 1}.`, [`result = ${found < 0 ? 'not found' : found}`, `checks = ${visited.size}`]);
  } else if (algorithm === 'total' || algorithm === 'average') {
    let total = 0;
    values.forEach((value, index) => {
      total += value;
      visited.add(index);
      add([index], [...visited], `Add ${value} to the running total: ${total}.`, [`total = ${total}`, `items processed = ${index + 1}`]);
    });
    add([], values.map((_, index) => index), algorithm === 'average' ? `Average = ${total} ÷ ${values.length} = ${(total / values.length).toFixed(2)}.` : `Final total = ${total}.`, algorithm === 'average' ? [`total = ${total}`, `average = ${(total / values.length).toFixed(2)}`] : [`total = ${total}`]);
  } else if (algorithm === 'count') {
    let count = 0;
    values.forEach((value, index) => {
      const qualifies = value >= target;
      if (qualifies) count++;
      visited.add(index);
      add([index], qualifies ? [...visited] : [], `${value} ${qualifies ? 'meets' : 'does not meet'} the condition (≥ ${target}).${qualifies ? ` Count is now ${count}.` : ''}`, [`count = ${count}`, `condition: value ≥ ${target}`]);
    });
    add([], [...visited].filter(index => values[index]! >= target), `${count} item${count === 1 ? '' : 's'} are at least ${target}.`, [`count = ${count}`]);
  } else {
    const findMax = algorithm === 'maximum';
    let best = values[0]!;
    let bestIndex = 0;
    add([0], [0], `Start with ${best} as the ${findMax ? 'maximum' : 'minimum'} so far.`, [`${findMax ? 'maximum' : 'minimum'} = ${best}`]);
    for (let index = 1; index < values.length; index++) {
      const improves = findMax ? values[index]! > best : values[index]! < best;
      if (improves) { best = values[index]!; bestIndex = index; }
      visited.add(index);
      add([index, bestIndex], [bestIndex], `${values[index]} ${improves ? `becomes the new ${findMax ? 'maximum' : 'minimum'}` : `does not replace ${best}`}.`, [`${findMax ? 'maximum' : 'minimum'} = ${best}`, `position = ${bestIndex + 1}`]);
    }
    add([bestIndex], [bestIndex], `The ${findMax ? 'maximum' : 'minimum'} is ${best}, at position ${bestIndex + 1}.`, [`${findMax ? 'maximum' : 'minimum'} = ${best}`]);
  }
  return frames;
}

export function createSortFrames(input: readonly number[], algorithm: SortAlgorithm): Omit<AlgorithmFrame, 'variables'>[] {
  const values = [...input];
  const frames: Omit<AlgorithmFrame, 'variables'>[] = [{ values: [...values], active: [], sorted: [], label: 'Ready to sort.' }];
  const add = (active: number[], sorted: number[], label: string) => frames.push({ values: [...values], active, sorted: [...sorted], label });
  const sorted = new Set<number>();

  if (algorithm === 'bubble') {
    for (let end = values.length - 1; end > 0; end--) {
      let swapped = false;
      for (let index = 0; index < end; index++) {
        add([index, index + 1], [...sorted], `Compare ${values[index]} and ${values[index + 1]}.`);
        if (values[index]! > values[index + 1]!) {
          [values[index], values[index + 1]] = [values[index + 1]!, values[index]!];
          swapped = true;
          add([index, index + 1], [...sorted], `Swap them: ${values[index]} moves left.`);
        }
      }
      sorted.add(end);
      if (!swapped) break;
    }
  } else if (algorithm === 'selection') {
    for (let start = 0; start < values.length; start++) {
      let min = start;
      for (let index = start + 1; index < values.length; index++) {
        add([min, index], [...sorted], `Compare ${values[min]} with ${values[index]}; keep the smaller value.`);
        if (values[index]! < values[min]!) min = index;
      }
      if (min !== start) {
        [values[start], values[min]] = [values[min]!, values[start]!];
        add([start, min], [...sorted], `Place ${values[start]} in position ${start + 1}.`);
      }
      sorted.add(start);
    }
  } else {
    sorted.add(0);
    for (let index = 1; index < values.length; index++) {
      const value = values[index]!;
      let cursor = index - 1;
      while (cursor >= 0) {
        add([cursor, cursor + 1], [...sorted], `Compare ${value} with ${values[cursor]}.`);
        if (values[cursor]! <= value) break;
        values[cursor + 1] = values[cursor]!;
        cursor--;
        add([cursor + 1, cursor + 2], [...sorted], `Shift ${value} one place to the left.`);
      }
      values[cursor + 1] = value;
      sorted.add(index);
      add([cursor + 1], [...sorted], `Insert ${value} into the sorted section.`);
    }
  }

  add([], values.map((_, index) => index), 'Sorted! Every value is in the right place.');
  return frames;
}

export function createRandomValues(size = 18): number[] {
  return Array.from({ length: size }, () => Math.floor(Math.random() * 90) + 10);
}
