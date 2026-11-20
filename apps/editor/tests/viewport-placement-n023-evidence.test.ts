import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ViewportPlacementErrorN023,
  placePopupFromViewportEvidenceN023,
} from '../src/adapters/browser/viewport-placement-n023-evidence.ts';

const owner = Object.freeze({identity: 'document-n023', instance: 'instance-n023'});

function surface(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    surfaceId: 'surface-main',
    owner,
    active: true,
    coordinateSpace: 'visual-viewport-css-px',
    source: 'window.visualViewport',
    sequence: 7,
    viewport: {left: 0, top: 0, width: 1280, height: 800},
    ...overrides,
  };
}

function anchor(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    surfaceId: 'surface-main',
    owner,
    coordinateSpace: 'visual-viewport-css-px',
    source: 'element.getBoundingClientRect',
    sequence: 7,
    rect: {left: 900, top: 80, right: 970, bottom: 112},
    ...overrides,
  };
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    surfaces: [surface()],
    anchor: anchor(),
    popup: {width: 340, height: 420},
    margin: 8,
    ...overrides,
  };
}

test('N023 selects the exact active document surface from multiple CSS-pixel viewports', () => {
  const result = placePopupFromViewportEvidenceN023(request({
    surfaces: [
      surface({surfaceId: 'surface-main', active: false}),
      surface({
        surfaceId: 'surface-left',
        viewport: {left: -1920, top: 0, width: 1920, height: 1080},
      }),
    ],
    anchor: anchor({
      surfaceId: 'surface-left',
      rect: {left: -500, top: 100, right: -400, bottom: 140},
    }),
    popup: {width: 420, height: 300},
  }));
  assert.deepEqual(result, {
    version: 1,
    surfaceId: 'surface-left',
    owner,
    coordinateSpace: 'visual-viewport-css-px',
    source: 'window.visualViewport',
    sequence: 7,
    viewport: {left: -1920, top: 0, width: 1920, height: 1080},
    anchor: {left: -500, top: 100, right: -400, bottom: 140},
    placement: {left: -500, top: 140, maxWidth: 1904, maxHeight: 932, side: 'below'},
  });
});

test('N023 rejects native/device-pixel geometry instead of guessing a DPI conversion', () => {
  for (const value of [
    request({surfaces: [surface({coordinateSpace: 'native-screen-device-px'})]}),
    request({anchor: anchor({coordinateSpace: 'native-screen-device-px'})}),
  ]) {
    assert.throws(() => placePopupFromViewportEvidenceN023(value), (error: unknown) =>
      error instanceof ViewportPlacementErrorN023 && error.code === 'unsupported-coordinate-space');
  }
});

test('N023 fails closed for inactive, ambiguous, stale-owner and stale-sequence evidence', () => {
  const otherOwner = {identity: 'document-other', instance: 'instance-other'};
  for (const [value, code] of [
    [request({surfaces: [surface({active: false})]}), 'no-active-surface'],
    [request({surfaces: [surface(), surface()]}), 'ambiguous-surface'],
    [request({anchor: anchor({owner: otherOwner})}), 'stale-owner'],
    [request({anchor: anchor({sequence: 8})}), 'stale-geometry'],
  ] as const) {
    assert.throws(() => placePopupFromViewportEvidenceN023(value), (error: unknown) =>
      error instanceof ViewportPlacementErrorN023 && error.code === code);
  }
});

test('N023 rejects off-viewport anchors and malformed or unbounded geometry', () => {
  for (const value of [
    request({anchor: anchor({rect: {left: 1270, top: 80, right: 1290, bottom: 112}})}),
    request({surfaces: [surface({viewport: {left: 0, top: 0, width: 0, height: 800}})]}),
    request({popup: {width: Number.POSITIVE_INFINITY, height: 420}}),
    request({margin: 129}),
    request({surfaces: Array.from({length: 17}, () => surface())}),
    {...request(), unexpected: 'field'},
  ]) {
    assert.throws(() => placePopupFromViewportEvidenceN023(value), ViewportPlacementErrorN023);
  }
});
