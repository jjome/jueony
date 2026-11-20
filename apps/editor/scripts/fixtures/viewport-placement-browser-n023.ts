import {currentVisualViewport, placeViewportPopup} from '../../src/adapters/browser/viewport-placement.ts';
import {installUnifiedChrome} from '../../src/unified-chrome.ts';

type Measurement = Readonly<{
  dpr: number;
  viewportScale: number;
  viewport: Readonly<{left: number; top: number; width: number; height: number}>;
  anchor: Readonly<{left: number; top: number; right: number; bottom: number}>;
  popupSize: Readonly<{width: number; height: number}>;
  placement: Readonly<{left: number; top: number; maxWidth: number; maxHeight: number; side: 'above' | 'below'}>;
  actual: Readonly<{left: number; top: number; width: number; height: number; maxWidth: number; maxHeight: number; side: string}>;
  open: boolean;
}>;

declare global {
  interface Window {
    __n023ViewportFixture?: Readonly<{
      ready: true;
      openAt(left: number, top: number): Promise<Measurement>;
      measure(): Measurement;
      moveAnchorAndDispatchViewportScroll(left: number, top: number): Promise<Measurement>;
    }>;
  }
}

const menus = requiredElement('menus');
const tools = requiredElement('tools');
const items = Array.from({length: 24}, (_, index) => Object.freeze({
  label: `메뉴 항목 ${index + 1}`,
  commandId: `fixture:command-${index + 1}`,
  enabled: true,
}));
const commands = items.map(item => Object.freeze({id: item.commandId, label: item.label, enabled: true}));
const editor = Object.freeze({
  menus: () => [Object.freeze({menuId: 'file', label: '파일', items})],
  commands: () => commands,
  toolbarsVisible: () => true,
});

const chrome = installUnifiedChrome({
  menus,
  tools,
  active: () => editor as never,
  execute: () => undefined,
  error: error => { throw error; },
});
chrome.refresh(true);

const fixture = Object.freeze({
  ready: true as const,
  async openAt(left: number, top: number): Promise<Measurement> {
    setAnchor(left, top);
    const detail = requiredDetail();
    detail.open = false;
    requiredSummary().click();
    await frames(2);
    return measure();
  },
  measure,
  async moveAnchorAndDispatchViewportScroll(left: number, top: number): Promise<Measurement> {
    setAnchor(left, top);
    window.visualViewport?.dispatchEvent(new Event('scroll'));
    await frames(2);
    return measure();
  },
});

window.__n023ViewportFixture = fixture;

function measure(): Measurement {
  const detail = requiredDetail();
  const summary = requiredSummary();
  const popup = requiredPopup();
  const anchor = summary.getBoundingClientRect();
  const viewport = currentVisualViewport(window);
  const popupSize = {width: popup.offsetWidth, height: popup.offsetHeight};
  const placement = placeViewportPopup(anchor, popupSize, viewport);
  const rect = popup.getBoundingClientRect();
  const style = getComputedStyle(popup);
  return Object.freeze({
    dpr: window.devicePixelRatio,
    viewportScale: window.visualViewport?.scale ?? 1,
    viewport: Object.freeze({...viewport}),
    anchor: Object.freeze({left: anchor.left, top: anchor.top, right: anchor.right, bottom: anchor.bottom}),
    popupSize: Object.freeze(popupSize),
    placement: Object.freeze(placement),
    actual: Object.freeze({
      left: numberStyle(popup.style.left),
      top: numberStyle(popup.style.top),
      width: rect.width,
      height: rect.height,
      maxWidth: numberStyle(style.maxWidth),
      maxHeight: numberStyle(style.maxHeight),
      side: popup.dataset.viewportSide ?? '',
    }),
    open: detail.open,
  });
}

function setAnchor(left: number, top: number): void {
  menus.style.left = `${left}px`;
  menus.style.top = `${top}px`;
}

function requiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) throw new Error(`missing fixture element: ${id}`);
  return element;
}

function requiredDetail(): HTMLDetailsElement {
  const detail = menus.querySelector(':scope > details');
  if (!(detail instanceof HTMLDetailsElement)) throw new Error('unified menu detail was not installed');
  return detail;
}

function requiredSummary(): HTMLElement {
  const summary = requiredDetail().querySelector(':scope > summary');
  if (!(summary instanceof HTMLElement)) throw new Error('unified menu summary was not installed');
  return summary;
}

function requiredPopup(): HTMLElement {
  const popup = requiredDetail().querySelector(':scope > .unified-menu-popup');
  if (!(popup instanceof HTMLElement)) throw new Error('unified menu popup was not installed');
  return popup;
}

function numberStyle(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) throw new Error(`non-finite popup style: ${value}`);
  return parsed;
}

function frames(count: number): Promise<void> {
  return new Promise(resolve => {
    const next = (remaining: number) => remaining <= 0 ? resolve() : requestAnimationFrame(() => next(remaining - 1));
    next(count);
  });
}
