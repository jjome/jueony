import assert from 'node:assert/strict';
import test from 'node:test';
import {
  consumeCharacterStyleUiSelectionN012,
  storeCharacterStyleUiSelectionN012,
} from '../src/adapters/rhwp/stored-character-style-ui-consumer-n012.ts';

type Style = { id: number; name: string; type: number; charShapeId: number };

const catalog = (): Style[] => [
  { id: 0, name: '바탕글', type: 0, charShapeId: 0 },
  { id: 1, name: '강조', type: 1, charShapeId: 8 },
];

const cursor = Object.fromEntries([
  'isInHeaderFooter',
  'isInFootnote',
  'isInTextBox',
  'isInCellSelectionMode',
  'isInTableObjectSelection',
  'isInPictureObjectSelection',
].map(key => [key, () => false]));

function document(styles: Style[]) {
  return {
    getSectionCount: () => 1,
    getParagraphCount: () => 1,
    getParagraphLength: () => 3,
    getStyleList: () => styles,
    getStyleDetail: (id: number) => ({ id, charProps: { bold: id === 1 } }),
  };
}

function input(native: unknown, selected = true) {
  let transactions = 0;
  const writes: unknown[][] = [];
  return {
    value: {
      cursor,
      getSelection: () => selected ? {
        start: { sectionIndex: 0, paragraphIndex: 0, charOffset: 0 },
        end: { sectionIndex: 0, paragraphIndex: 0, charOffset: 2 },
      } : null,
      getPosition: () => ({ sectionIndex: 0, paragraphIndex: 0, charOffset: 2 }),
      executeOperation: (operation: any) => {
        transactions += 1;
        operation.operation({
          ...(native as object),
          setCharShapeRuns: (...args: unknown[]) => {
            writes.push(args);
            return JSON.stringify({ ok: true });
          },
        });
      },
    },
    transactions: () => transactions,
    writes,
  };
}

test('a UI-stored reference is resolved at consumption and applies the stored native shape id', () => {
  const styles = catalog();
  const live = document(styles);
  const stored = storeCharacterStyleUiSelectionN012(live, 1);
  assert.equal(stored.status, 'stored');
  if (stored.status !== 'stored') return;
  assert.equal(Object.isFrozen(stored.token), true);
  assert.equal(Object.isFrozen(stored.token.reference), true);

  const ui = input(live);
  assert.deepEqual(consumeCharacterStyleUiSelectionN012(ui.value, live, stored.token), {
    status: 'applied',
  });
  assert.equal(ui.transactions(), 1);
  assert.equal((ui.writes[0][4] as any)[0].charShapeId, 8);
});

test('stale and missing stored-time definitions fail before opening a mutation transaction', () => {
  for (const mode of ['stale', 'missing'] as const) {
    const styles = catalog();
    const live = document(styles);
    const stored = storeCharacterStyleUiSelectionN012(live, 1);
    assert.equal(stored.status, 'stored');
    if (stored.status !== 'stored') continue;
    if (mode === 'stale') styles[1] = { ...styles[1], name: '변경된 강조' };
    else styles.pop();

    const ui = input(live);
    assert.deepEqual(consumeCharacterStyleUiSelectionN012(ui.value, live, stored.token), {
      status: 'rejected',
      reason: 'definition-stale-or-missing',
    }, mode);
    assert.equal(ui.transactions(), 0, mode);
    assert.equal(ui.writes.length, 0, mode);
  }
});

test('a definition race after UI preflight is rejected inside the transaction before the first write', () => {
  const styles = catalog();
  const live = document(styles);
  const stored = storeCharacterStyleUiSelectionN012(live, 1);
  assert.equal(stored.status, 'stored');
  if (stored.status !== 'stored') return;
  const raced = document([{ ...styles[0] }, { ...styles[1], charShapeId: 9 }]);
  const ui = input(raced);

  assert.deepEqual(consumeCharacterStyleUiSelectionN012(ui.value, live, stored.token), {
    status: 'rejected',
    reason: 'application-rejected',
  });
  assert.equal(ui.transactions(), 1);
  assert.equal(ui.writes.length, 0);
});

test('invalid, forged, missing and ambiguous UI selections never claim success', () => {
  const styles = catalog();
  const live = document(styles);
  const ui = input(live);
  for (const value of [
    undefined,
    {},
    { kind: 'stored-character-style-ui-selection', version: 2, reference: {} },
    {
      kind: 'stored-character-style-ui-selection',
      version: 1,
      reference: {
        kind: 'stored-character-style',
        version: 1,
        styleId: 1,
        charShapeId: 8,
        definitionSha256: 'not-a-digest',
      },
    },
  ]) {
    assert.deepEqual(consumeCharacterStyleUiSelectionN012(ui.value, live, value), {
      status: 'rejected',
      reason: 'invalid-token',
    });
  }
  assert.equal(ui.transactions(), 0);

  assert.deepEqual(storeCharacterStyleUiSelectionN012(live, 9), {
    status: 'rejected',
    reason: 'definition-missing-or-ambiguous',
  });
  styles.push({ id: 2, name: '공유', type: 1, charShapeId: 8 });
  assert.deepEqual(storeCharacterStyleUiSelectionN012(live, 1), {
    status: 'rejected',
    reason: 'definition-missing-or-ambiguous',
  });
});

test('a valid stored selection with no current text selection remains a no-op', () => {
  const styles = catalog();
  const live = document(styles);
  const stored = storeCharacterStyleUiSelectionN012(live, 1);
  assert.equal(stored.status, 'stored');
  if (stored.status !== 'stored') return;
  const ui = input(live, false);
  assert.deepEqual(consumeCharacterStyleUiSelectionN012(ui.value, live, stored.token), {
    status: 'no-selection',
  });
  assert.equal(ui.transactions(), 0);
  assert.equal(ui.writes.length, 0);
});
