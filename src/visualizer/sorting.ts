export type SortAlgorithm = 'bubble' | 'selection' | 'insertion';

export interface SortFrame {
  values: number[];
  active: number[];
  sorted: number[];
  label: string;
}

export const SORT_ALGORITHMS: Record<SortAlgorithm, { name: string; description: string; complexity: string }> = {
  bubble: { name: 'Bubble sort', description: 'Compare neighboring values and move the larger one toward the end.', complexity: 'O(n²) time · O(1) space' },
  selection: { name: 'Selection sort', description: 'Find the smallest remaining value and place it in the next open position.', complexity: 'O(n²) time · O(1) space' },
  insertion: { name: 'Insertion sort', description: 'Take each value and slide it left into its correct place in the sorted section.', complexity: 'O(n²) time · O(1) space' },
};

export function createSortFrames(input: readonly number[], algorithm: SortAlgorithm): SortFrame[] {
  const values = [...input];
  const frames: SortFrame[] = [{ values: [...values], active: [], sorted: [], label: 'Ready to sort.' }];
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

  const all = values.map((_, index) => index);
  add([], all, 'Sorted! Every value is in the right place.');
  return frames;
}

export function createRandomValues(size = 18): number[] {
  return Array.from({ length: size }, () => Math.floor(Math.random() * 90) + 10);
}
