export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface AnchorRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PopupPlacement {
  left: number;
  top: number;
  maxWidth: number;
  maxHeight: number;
  side: 'above' | 'below';
}

const finite = (value: number, fallback = 0): number => Number.isFinite(value) ? value : fallback;
const clamp = (value: number, minimum: number, maximum: number): number => Math.max(minimum, Math.min(value, maximum));

/**
 * Places a fixed popup in visual-viewport CSS pixels. Browser zoom changes the
 * visual viewport but not the document coordinate system, so devicePixelRatio
 * must not be applied a second time here.
 */
export function placeViewportPopup(
  anchor: AnchorRect,
  popup: { width: number; height: number },
  viewport: ViewportRect,
  margin = 8,
): PopupPlacement {
  const inset = Math.max(0, finite(margin));
  const leftEdge = finite(viewport.left) + inset;
  const topEdge = finite(viewport.top) + inset;
  const width = Math.max(0, finite(viewport.width));
  const height = Math.max(0, finite(viewport.height));
  const rightEdge = finite(viewport.left) + width - inset;
  const bottomEdge = finite(viewport.top) + height - inset;
  const maxWidth = Math.max(0, width - inset * 2);
  const renderedWidth = Math.min(maxWidth, Math.max(0, finite(popup.width)));
  const left = clamp(finite(anchor.left, leftEdge), leftEdge, Math.max(leftEdge, rightEdge - renderedWidth));
  const below = Math.max(0, bottomEdge - finite(anchor.bottom, topEdge));
  const above = Math.max(0, finite(anchor.top, bottomEdge) - topEdge);
  const desiredHeight = Math.max(0, finite(popup.height));
  const side: PopupPlacement['side'] = below >= Math.min(desiredHeight, 160) || below >= above ? 'below' : 'above';
  const maxHeight = side === 'below' ? below : above;
  const top = side === 'below'
    ? clamp(finite(anchor.bottom, topEdge), topEdge, bottomEdge)
    : clamp(finite(anchor.top, bottomEdge) - Math.min(desiredHeight, above), topEdge, bottomEdge);
  return { left, top, maxWidth, maxHeight, side };
}

export function currentVisualViewport(target: Window): ViewportRect {
  const viewport = target.visualViewport;
  return viewport
    ? { left: viewport.offsetLeft, top: viewport.offsetTop, width: viewport.width, height: viewport.height }
    : { left: 0, top: 0, width: target.innerWidth, height: target.innerHeight };
}
