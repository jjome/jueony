import {sha256} from '@noble/hashes/sha2.js';

export type LabelSheetLayoutB126 = Readonly<{
  rows: number;
  columns: number;
  labelWidthMm: number;
  labelHeightMm: number;
}>;

export type LabelSheetRequestB126 = Readonly<{
  layout: LabelSheetLayoutB126;
  labels: readonly string[];
}>;

export type LabelSheetPlanB126 = Readonly<{
  schemaVersion: 1;
  documentIdentity: string;
  documentRevision: string;
  layout: LabelSheetLayoutB126;
  labels: readonly string[];
  beforeFingerprint: string;
  fingerprint: string;
}>;

export type LabelSheetLocationB126 = Readonly<{section: 0; paragraph: number; control: number}>;

export interface LabelSheetDocumentB126 {
  getSectionCount(): number;
  getParagraphCount(section: number): number;
  getParagraphLength(section: number, paragraph: number): number;
  getControls(): unknown;
  createTable(section: number, paragraph: number, offset: number, rows: number, columns: number): unknown;
  insertTextInCell(section: number, paragraph: number, control: number, cell: number, cellParagraph: number, offset: number, text: string): unknown;
  setCellProperties(section: number, paragraph: number, control: number, cell: number, properties: string): unknown;
  getCellParagraphLength(section: number, paragraph: number, control: number, cell: number, cellParagraph: number): number;
  getTextInCell(section: number, paragraph: number, control: number, cell: number, cellParagraph: number, start: number, end: number): string;
  getCellProperties(section: number, paragraph: number, control: number, cell: number): unknown;
  saveSnapshot(): number;
  restoreSnapshot(token: number): unknown;
  discardSnapshot(token: number): void;
  exportHwp(): Uint8Array;
  exportHwpx(): Uint8Array;
}

export type LabelSheetHistoryB126 = Readonly<{
  location: LabelSheetLocationB126;
  undo(): boolean;
  redo(): boolean;
  dispose(): void;
}>;

const owners = new WeakMap<LabelSheetPlanB126, LabelSheetDocumentB126>();
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
const hex = (bytes: Uint8Array): string => [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
const digest = (value: Uint8Array | string): string => hex(sha256(typeof value === 'string' ? new TextEncoder().encode(value) : value));
const jsonDigest = (value: unknown): string => digest(JSON.stringify(value));
const millimetres = (value: number): number => Math.round(value * 283.465);

function parse(value: unknown): Record<string, unknown> {
  const result = typeof value === 'string' ? JSON.parse(value) : value;
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('문서 엔진 응답을 확인하지 못했습니다.');
  return result as Record<string, unknown>;
}

function accepted(value: unknown, action: string): Record<string, unknown> {
  const result = parse(value);
  if (result.ok === false) throw new Error(`${action}에 실패했습니다.`);
  return result;
}

function token(value: string, label: string): string {
  if (!TOKEN.test(value)) throw new Error(`${label}가 올바르지 않습니다.`);
  return value;
}

function scalarLength(value: string): number {
  return [...value].length;
}

function labels(values: readonly string[], capacity: number): readonly string[] {
  if (!Array.isArray(values) || values.length === 0 || values.length > capacity) {
    throw new Error(`라벨 문구는 1개 이상 ${capacity}개 이하이어야 합니다.`);
  }
  return Object.freeze(values.map(value => {
    if (typeof value !== 'string' || scalarLength(value) > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value)) {
      throw new Error('라벨 문구는 제어 문자가 없는 500자 이하 문자열이어야 합니다.');
    }
    return value;
  }));
}

function layout(value: LabelSheetLayoutB126): LabelSheetLayoutB126 {
  if (!value || !Number.isSafeInteger(value.rows) || value.rows < 1 || value.rows > 20 ||
      !Number.isSafeInteger(value.columns) || value.columns < 1 || value.columns > 10 || value.rows * value.columns > 100) {
    throw new Error('라벨 격자는 1~20행과 1~10열 및 최대 100칸 범위여야 합니다.');
  }
  for (const [name, length] of [['너비', value.labelWidthMm], ['높이', value.labelHeightMm]] as const) {
    if (!Number.isFinite(length) || length < 10 || length > 100 || Math.round(length * 100) !== length * 100) {
      throw new Error(`라벨 ${name}는 10~100 mm 범위의 0.01 mm 단위여야 합니다.`);
    }
  }
  if (value.columns * value.labelWidthMm > 250 || value.rows * value.labelHeightMm > 350) {
    throw new Error('라벨 격자가 지원하는 용지 배치 한도를 넘습니다.');
  }
  return Object.freeze({...value});
}

function byteFingerprint(document: LabelSheetDocumentB126): string {
  return jsonDigest({hwp: digest(document.exportHwp()), hwpx: digest(document.exportHwpx())});
}

function exactBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function blankFingerprint(document: LabelSheetDocumentB126): string {
  if (document.getSectionCount() !== 1 || document.getParagraphCount(0) !== 1 || document.getParagraphLength(0, 0) !== 0) {
    throw new Error('라벨 용지는 내용이 없는 새 문서에서만 만들 수 있습니다.');
  }
  const controls = typeof document.getControls() === 'string' ? JSON.parse(document.getControls() as string) : document.getControls();
  if (!Array.isArray(controls) || controls.some(value => {
    if (!value || typeof value !== 'object') return true;
    const control = value as {ctrlId?: unknown; list?: unknown; para?: unknown};
    return control.list !== 0 || control.para !== 0 || (control.ctrlId !== 'secd' && control.ctrlId !== 'cold');
  })) throw new Error('라벨 용지는 기본 구역·단 정의 외 제어 개체가 없는 새 문서에서만 만들 수 있습니다.');
  return byteFingerprint(document);
}

function cellText(document: LabelSheetDocumentB126, location: LabelSheetLocationB126, cell: number): string {
  const length = document.getCellParagraphLength(0, location.paragraph, location.control, cell, 0);
  if (!Number.isSafeInteger(length) || length < 0 || length > 1_000_000) throw new Error('라벨 셀 길이를 확인하지 못했습니다.');
  return document.getTextInCell(0, location.paragraph, location.control, cell, 0, 0, length);
}

function verifySheet(document: LabelSheetDocumentB126, location: LabelSheetLocationB126, plan: LabelSheetPlanB126): void {
  const width = millimetres(plan.layout.labelWidthMm), height = millimetres(plan.layout.labelHeightMm);
  const capacity = plan.layout.rows * plan.layout.columns;
  for (let cell = 0; cell < capacity; cell += 1) {
    if (cellText(document, location, cell) !== (plan.labels[cell] ?? '')) throw new Error('라벨 문구 저장 결과가 요청과 다릅니다.');
    const properties = parse(document.getCellProperties(0, location.paragraph, location.control, cell));
    if (properties.width !== width || properties.height !== height) throw new Error('라벨 셀 크기 저장 결과가 요청과 다릅니다.');
  }
}

export function prepareLabelSheetB126(
  document: LabelSheetDocumentB126,
  documentIdentityValue: string,
  documentRevisionValue: string,
  request: LabelSheetRequestB126,
): LabelSheetPlanB126 {
  const documentIdentity = token(documentIdentityValue, '문서 식별자');
  const documentRevision = token(documentRevisionValue, '문서 버전');
  const normalizedLayout = layout(request.layout);
  const normalizedLabels = labels(request.labels, normalizedLayout.rows * normalizedLayout.columns);
  const beforeFingerprint = blankFingerprint(document);
  const fingerprint = jsonDigest({schemaVersion: 1, documentIdentity, documentRevision, layout: normalizedLayout, labels: normalizedLabels, beforeFingerprint});
  const plan: LabelSheetPlanB126 = Object.freeze({schemaVersion: 1, documentIdentity, documentRevision, layout: normalizedLayout,
    labels: normalizedLabels, beforeFingerprint, fingerprint});
  owners.set(plan, document);
  return plan;
}

export function applyLabelSheetB126(
  document: LabelSheetDocumentB126,
  plan: LabelSheetPlanB126,
  currentIdentity: string,
  currentRevision: string,
): LabelSheetHistoryB126 {
  if (owners.get(plan) !== document) throw new Error('라벨 계획을 만든 문서와 적용할 문서가 다릅니다.');
  if (token(currentIdentity, '문서 식별자') !== plan.documentIdentity || token(currentRevision, '문서 버전') !== plan.documentRevision) {
    throw new Error('문서 또는 버전이 바뀌었습니다. 다시 요청해 주세요.');
  }
  const expectedFingerprint = jsonDigest({schemaVersion: 1, documentIdentity: plan.documentIdentity, documentRevision: plan.documentRevision,
    layout: plan.layout, labels: plan.labels, beforeFingerprint: plan.beforeFingerprint});
  if (expectedFingerprint !== plan.fingerprint || blankFingerprint(document) !== plan.beforeFingerprint) {
    throw new Error('문서 또는 라벨 계획이 바뀌었습니다. 다시 요청해 주세요.');
  }

  const beforeHwp = document.exportHwp(), beforeHwpx = document.exportHwpx();
  const beforeToken = document.saveSnapshot();
  if (!Number.isSafeInteger(beforeToken) || beforeToken < 0) throw new Error('라벨 작업 복구 지점을 만들지 못했습니다.');
  let afterToken: number | undefined;
  try {
    const created = accepted(document.createTable(0, 0, 0, plan.layout.rows, plan.layout.columns), '라벨 격자 생성');
    if (!Number.isSafeInteger(created.paraIdx) || !Number.isSafeInteger(created.controlIdx)) throw new Error('생성한 라벨 격자의 위치를 확인하지 못했습니다.');
    const location: LabelSheetLocationB126 = Object.freeze({section: 0, paragraph: created.paraIdx as number, control: created.controlIdx as number});
    const width = millimetres(plan.layout.labelWidthMm), height = millimetres(plan.layout.labelHeightMm);
    for (let cell = 0; cell < plan.layout.rows * plan.layout.columns; cell += 1) {
      accepted(document.setCellProperties(0, location.paragraph, location.control, cell, JSON.stringify({width, height})), '라벨 셀 크기 설정');
      const value = plan.labels[cell] ?? '';
      if (value) accepted(document.insertTextInCell(0, location.paragraph, location.control, cell, 0, 0, value), '라벨 문구 입력');
    }
    verifySheet(document, location, plan);
    const appliedFingerprint = byteFingerprint(document);
    afterToken = document.saveSnapshot();
    if (!Number.isSafeInteger(afterToken) || afterToken < 0) throw new Error('라벨 작업 완료 지점을 만들지 못했습니다.');
    let state: 'applied' | 'undone' | 'disposed' = 'applied';
    const restore = (tokenValue: number, fingerprint: string): boolean => {
      const result = accepted(document.restoreSnapshot(tokenValue), '라벨 작업 상태 복원');
      if (result.ok !== true || byteFingerprint(document) !== fingerprint) throw new Error('라벨 작업 상태를 정확히 복원하지 못했습니다.');
      return true;
    };
    return Object.freeze({
      location,
      undo: () => {
        if (state !== 'applied') return false;
        restore(beforeToken, plan.beforeFingerprint); state = 'undone'; return true;
      },
      redo: () => {
        if (state !== 'undone') return false;
        restore(afterToken!, appliedFingerprint); state = 'applied'; return true;
      },
      dispose: () => {
        if (state === 'disposed') return;
        document.discardSnapshot(beforeToken); document.discardSnapshot(afterToken!); state = 'disposed';
      },
    });
  } catch (error) {
    let restored = false;
    try {
      const result = accepted(document.restoreSnapshot(beforeToken), '실패한 라벨 작업 복구');
      restored = result.ok === true && exactBytes(document.exportHwp(), beforeHwp) && exactBytes(document.exportHwpx(), beforeHwpx);
    } finally {
      document.discardSnapshot(beforeToken);
      if (afterToken !== undefined) document.discardSnapshot(afterToken);
    }
    if (!restored) throw new Error('실패한 라벨 작업 뒤 원문을 정확히 복구하지 못했습니다.', {cause: error});
    throw error;
  }
}

export function manuscriptPaperCapabilityB126(document: object): Readonly<{supported: false; reason: string}> {
  void document;
  return Object.freeze({supported: false, reason: '현재 엔진에는 원고지 전용 용지·칸 배치와 저장 의미를 함께 보존하는 공개 API가 없습니다.'});
}
