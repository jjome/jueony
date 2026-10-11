import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCaptionSnapshot, captionPatch, captionPlacements, installCaptionCommands, isBodyCaptionTarget } from '../src/adapters/rhwp/manual-commands.ts';

test('caption positions preserve existing spacing/width and use native enum types for each object kind', () => {
  const original = { hasCaption: true, captionDirection: 'Bottom', captionVertAlign: 'Top', captionSpacing: 654, captionWidth: 7777 };
  assert.deepEqual(captionPatch(original, 'lm'), { hasCaption: true, captionDirection: 'Left', captionVertAlign: 'Center' });
  assert.deepEqual(captionPatch(original, 'rb', true), { hasCaption: true, captionDirection: 1, captionVertAlign: 2 });
  assert.equal(captionPatch(original, 'bottom'), null);
  assert.equal(original.captionSpacing, 654);
  assert.deepEqual(captionPatch(original, 'none'), { hasCaption: false });
  assert.equal(captionPatch({}, 'none'), null);
  const created = captionPatch({}, 'top')!;
  assert.equal(created.captionDirection, 'Top');
  assert.equal(created.captionWidth, 8504);
  assert.equal(created.captionSpacing, 850);
  assert.equal(Object.keys(captionPlacements).length, 8);
});

test('caption snapshot is routed exactly once, a rejected operation never calls native mutation', () => {
  let calls = 0;
  const ref = { sec: 1, ppi: 2, ci: 3 }, patch = { hasCaption: true };
  const apply = (wasm: unknown, target: unknown, props: unknown) => {
    assert.equal(wasm, 'native'); assert.equal(target, ref); assert.equal(props, patch); calls++; return { ok: true };
  };
  const input = { executeOperation(op: any) { assert.equal(op.kind, 'snapshot'); assert.deepEqual(op.operation('native'), { sectionIndex: 1, paragraphIndex: 2, charOffset: 0 }); } };
  assert.equal(applyCaptionSnapshot(input, ref, patch, apply), true); assert.equal(calls, 1);
  assert.equal(applyCaptionSnapshot(input, ref, null, apply), false); assert.equal(calls, 1);
  assert.equal(applyCaptionSnapshot({ executeOperation() {} }, ref, patch, apply), false); assert.equal(calls, 1);
  assert.throws(() => applyCaptionSnapshot(input, ref, patch, () => ({ ok: false })), /적용되지/);
});

test('caption registry enables supported body objects and excludes readonly/multiple/nested/HF targets', () => {
  const commands = new Map<string, any>();
  let ref: any = { sec: 0, ppi: 0, ci: 0, type: 'image' };
  let multi = false;
  const ih = { getSelectedPictureRef: () => ref, cursor: { isMultiPictureSelection: () => multi } };
  installCaptionCommands({ registry: { register(c: any) { commands.set(c.id, c); } }, input: () => ih, getObjectProps: () => ({}), setObjectProps() {} });
  assert.equal(commands.size, 9);
  const ctx = { hasDocument: true, isEditable: true, isFormMode: false };
  const enabled = () => commands.get('insert:caption-top').canExecute(ctx);
  assert.equal(enabled(), true);
  multi = true; assert.equal(enabled(), false); multi = false;
  assert.equal(commands.get('insert:caption-top').canExecute({ ...ctx, isEditable: false }), false);
  for (const extra of [{ type: 'equation' }, { cellPath: [{}] }, { cellIdx: 0 }, { headerFooter: {} }, { noteRef: {} }]) {
    ref = { sec: 0, ppi: 0, ci: 0, type: 'image', ...extra };
    assert.equal(isBodyCaptionTarget(ref), false); assert.equal(enabled(), false);
  }
});

test('caption command removal creates a single snapshot and native failure is surfaced', () => {
  const commands = new Map<string, any>();
  let props: Record<string, unknown> = { hasCaption: true }, snapshots = 0, focus = 0;
  const ih = {
    getSelectedPictureRef: () => ({ sec: 0, ppi: 0, ci: 0, type: 'shape' }),
    executeOperation(op: any) { snapshots++; op.operation({}); }, focus() { focus++; },
  };
  installCaptionCommands({ registry: { register(c: any) { commands.set(c.id, c); } }, input: () => ih, getObjectProps: () => props, setObjectProps(_w, _r, p) { props = { ...props, ...p }; return { ok: true }; } });
  commands.get('insert:caption-none').execute({ wasm: {} });
  assert.equal(props.hasCaption, false); assert.equal(snapshots, 1); assert.equal(focus, 1);
  commands.get('insert:caption-none').execute({ wasm: {} });
  assert.equal(snapshots, 1);
});
