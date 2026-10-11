import type { DocumentFitMode } from '../public/contracts.ts';

export interface DocumentViewport {
  getZoom(): number; getZoomFitMode(): DocumentFitMode; getScrollX(): number; getScrollY(): number;
  setZoom(zoom: number, anchor?: { x: number; y: number }, fitMode?: DocumentFitMode): void;
  setScrollLeft(value: number): void; setScrollTop(value: number): void;
}

export interface DocumentViewAdapterOptions {
  viewport: () => DocumentViewport | undefined;
  identity: () => string;
  visible: () => boolean;
  /** Use the existing Studio fit calculation for this document and viewport. */
  applyFit: (mode: Exclude<DocumentFitMode, 'none'>) => void;
  /** Resolve after layout has reflected the new zoom (for example two RAFs). */
  settle: () => Promise<void>;
}
