import test from 'node:test';
import assert from 'node:assert/strict';
import { placeViewportPopup } from '../src/adapters/browser/viewport-placement.ts';

test('popup placement uses visual viewport CSS pixels without multiplying browser zoom', () => {
  const placed = placeViewportPopup(
    { left: 910, top: 84, right: 970, bottom: 112 },
    { width: 340, height: 420 },
    { left: 400, top: 50, width: 600, height: 500 },
  );
  assert.deepEqual(placed, { left: 652, top: 112, maxWidth: 584, maxHeight: 430, side: 'below' });
});

test('popup flips above when a narrow high-DPI viewport has no usable room below', () => {
  const placed = placeViewportPopup(
    { left: 300, top: 610, right: 380, bottom: 638 },
    { width: 280, height: 360 },
    { left: 120, top: 200, width: 420, height: 460 },
  );
  assert.deepEqual(placed, { left: 252, top: 250, maxWidth: 404, maxHeight: 402, side: 'above' });
});

test('popup placement remains finite for collapsed and invalid viewport measurements', () => {
  const placed = placeViewportPopup(
    { left: Number.NaN, top: Number.NaN, right: 0, bottom: Number.NaN },
    { width: Number.POSITIVE_INFINITY, height: Number.NaN },
    { left: 30, top: 40, width: -1, height: 0 },
  );
  assert.deepEqual(placed, { left: 38, top: 48, maxWidth: 0, maxHeight: 0, side: 'below' });
});
