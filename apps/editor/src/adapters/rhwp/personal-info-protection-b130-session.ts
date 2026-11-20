import {sha256} from '@noble/hashes/sha2.js';
import {
  capturePersonalInfoConversionB146,
  type PersonalInfoContextB146,
  type PersonalInfoHostB146,
  type PersonalInfoKindB146,
  type PersonalInfoSelectionB146,
} from './personal-info-conversion-b146.ts';

export interface PersonalInfoProtectionHostB130 extends PersonalInfoHostB146 {
  exportHwp(): Uint8Array;
  exportHwpx(): Uint8Array;
}

export interface PersonalInfoProtectionContextB130 extends PersonalInfoContextB146 {
  documentInstance(): unknown;
}

export type PersonalInfoProtectionDigestsB130 = Readonly<{
  hwpSha256: string;
  hwpxSha256: string;
}>;

/**
 * This receipt is deliberately metadata-only. Original/replacement text,
 * snapshot tokens, keys and secrets never cross the session boundary.
 */
export type PersonalInfoProtectionReceiptB130 = Readonly<{
  version: 1;
  documentIdentity: string;
  documentInstance: string;
  beforeRevision: string;
  afterRevision: string;
  range: Readonly<PersonalInfoSelectionB146>;
  before: PersonalInfoProtectionDigestsB130;
  after: PersonalInfoProtectionDigestsB130;
}>;

export type PersonalInfoProtectionBlockReasonB130 =
  | 'api-unavailable' | 'invalid-context' | 'session-ended' | 'capacity-reached'
  | 'capture-rejected' | 'history-unavailable' | 'mutation-rejected'
  | 'verification-failed' | 'unknown-receipt' | 'history-state-mismatch';

export type PersonalInfoProtectionTransitionB130 =
  | {status: 'protected'; receipt: PersonalInfoProtectionReceiptB130}
  | {status: 'unprotected'; receipt: PersonalInfoProtectionReceiptB130}
  | {status: 'reprotected'; receipt: PersonalInfoProtectionReceiptB130}
  | {status: 'blocked'; reason: PersonalInfoProtectionBlockReasonB130}
  | {status: 'state-uncertain'; reason: 'rollback-failed'};

type ReceiptState = 'before' | 'after';
type ReceiptEntry = {
  beforeToken: number;
  afterToken: number;
  state: ReceiptState;
};

const IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
const MAX_ACTIVE_RECEIPTS = 8;
const required = [
  'getTextRange', 'replaceText', 'saveSnapshot', 'restoreSnapshot', 'discardSnapshot', 'exportHwp', 'exportHwpx',
] as const;

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function accepted(value: unknown): boolean {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return record(parsed)?.ok === true;
  } catch { return false; }
}

function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function scalarLength(value: string): number { return Array.from(value).length; }

function digest(bytes: Uint8Array): string {
  return [...sha256(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function sameDigests(left: PersonalInfoProtectionDigestsB130, right: PersonalInfoProtectionDigestsB130): boolean {
  return left.hwpSha256 === right.hwpSha256 && left.hwpxSha256 === right.hwpxSha256;
}

function hasHost(value: Partial<PersonalInfoProtectionHostB130>): value is PersonalInfoProtectionHostB130 {
  return required.every(name => typeof (value as Record<string, unknown>)[name] === 'function');
}

function metadata(host: PersonalInfoProtectionHostB130): PersonalInfoProtectionDigestsB130 | undefined {
  try {
    const hwp = host.exportHwp(), hwpx = host.exportHwpx();
    if (!(hwp instanceof Uint8Array) || !(hwpx instanceof Uint8Array)) return undefined;
    return Object.freeze({hwpSha256: digest(hwp), hwpxSha256: digest(hwpx)});
  } catch { return undefined; }
}

function owner(context: PersonalInfoProtectionContextB130):
Readonly<{identity: string; instance: string; revision: string}> | undefined {
  try {
    const identity = context.documentIdentity(), instance = context.documentInstance(), revision = context.revision();
    if (typeof identity !== 'string' || typeof instance !== 'string' || typeof revision !== 'string'
      || !IDENTITY.test(identity) || !IDENTITY.test(instance) || !IDENTITY.test(revision)) return undefined;
    return Object.freeze({identity, instance, revision});
  } catch { return undefined; }
}

function editableContext(context: PersonalInfoProtectionContextB130): boolean {
  try { return context.story() === 'body' && context.editable() === true && context.protected() !== true; }
  catch { return false; }
}

function sameOwner(
  value: Readonly<{identity: string; instance: string; revision: string}>,
  receipt: PersonalInfoProtectionReceiptB130,
  expected: 'before' | 'after',
): boolean {
  return value.identity === receipt.documentIdentity && value.instance === receipt.documentInstance
    && value.revision === (expected === 'before' ? receipt.beforeRevision : receipt.afterRevision);
}

function readSelection(host: PersonalInfoProtectionHostB130, selection: PersonalInfoSelectionB146): string | undefined {
  try {
    const count = selection.endOffset - selection.startOffset;
    const value = host.getTextRange(selection.sectionIndex, selection.paragraphIndex, selection.startOffset, count);
    return typeof value === 'string' && scalarLength(value) === count ? value : undefined;
  } catch { return undefined; }
}

function replaceSelection(
  host: PersonalInfoProtectionHostB130,
  selection: PersonalInfoSelectionB146,
  replacement: string,
): boolean {
  try {
    return accepted(host.replaceText(selection.sectionIndex, selection.paragraphIndex, selection.startOffset,
      selection.endOffset - selection.startOffset, replacement));
  } catch { return false; }
}

export class PersonalInfoProtectionSessionB130 {
  readonly #host: PersonalInfoProtectionHostB130 | undefined;
  readonly #context: PersonalInfoProtectionContextB130;
  readonly #entries = new Map<PersonalInfoProtectionReceiptB130, ReceiptEntry>();
  #disposed = false;

  constructor(host: Partial<PersonalInfoProtectionHostB130>, context: PersonalInfoProtectionContextB130) {
    this.#host = hasHost(host) ? host : undefined;
    this.#context = context;
  }

  protect(kinds: unknown): PersonalInfoProtectionTransitionB130 {
    if (this.#disposed) return {status: 'blocked', reason: 'session-ended'};
    if (!this.#host) return {status: 'blocked', reason: 'api-unavailable'};
    if (this.#entries.size >= MAX_ACTIVE_RECEIPTS) return {status: 'blocked', reason: 'capacity-reached'};
    const captured = capturePersonalInfoConversionB146(this.#host, this.#context, kinds);
    if (captured.status !== 'ready') return {status: 'blocked', reason: 'capture-rejected'};
    const initialOwner = owner(this.#context), before = metadata(this.#host);
    if (!initialOwner || !before || initialOwner.identity !== captured.plan.documentIdentity
      || initialOwner.revision !== captured.plan.revision) return {status: 'blocked', reason: 'invalid-context'};

    let beforeToken: number | undefined, afterToken: number | undefined;
    try {
      const beforeCandidate = this.#host.saveSnapshot();
      if (!integer(beforeCandidate)) return {status: 'blocked', reason: 'history-unavailable'};
      beforeToken = beforeCandidate;
      const guardedOwner = owner(this.#context), guardedDigest = metadata(this.#host);
      if (!guardedOwner || guardedOwner.identity !== initialOwner.identity
        || guardedOwner.instance !== initialOwner.instance || guardedOwner.revision !== initialOwner.revision
        || !guardedDigest || !sameDigests(guardedDigest, before)) throw new Error('stale');
      if (!replaceSelection(this.#host, captured.plan.selection, captured.plan.replacementText)) throw new Error('mutation');
      const changedOwner = owner(this.#context), after = metadata(this.#host);
      if (!changedOwner || changedOwner.identity !== initialOwner.identity || changedOwner.instance !== initialOwner.instance
        || changedOwner.revision === initialOwner.revision || !after || sameDigests(after, before)
        || readSelection(this.#host, captured.plan.selection) !== captured.plan.replacementText) throw new Error('verification');
      const afterCandidate = this.#host.saveSnapshot();
      if (!integer(afterCandidate)) throw new Error('snapshot');
      afterToken = afterCandidate;
      const snapshottedOwner = owner(this.#context), snapshottedDigest = metadata(this.#host);
      if (!snapshottedOwner || snapshottedOwner.identity !== changedOwner.identity
        || snapshottedOwner.instance !== changedOwner.instance || snapshottedOwner.revision !== changedOwner.revision
        || !snapshottedDigest || !sameDigests(snapshottedDigest, after)) throw new Error('snapshot-drift');
      const receipt = Object.freeze({
        version: 1 as const,
        documentIdentity: initialOwner.identity,
        documentInstance: initialOwner.instance,
        beforeRevision: initialOwner.revision,
        afterRevision: changedOwner.revision,
        range: Object.freeze({...captured.plan.selection}),
        before,
        after,
      });
      this.#entries.set(receipt, {beforeToken, afterToken, state: 'after'});
      return {status: 'protected', receipt};
    } catch (error) {
      if (beforeToken === undefined) return {status: 'blocked', reason: 'history-unavailable'};
      try {
        if (!accepted(this.#host.restoreSnapshot(beforeToken))) throw new Error('restore');
        const restoredOwner = owner(this.#context), restoredDigest = metadata(this.#host);
        if (!restoredOwner || restoredOwner.identity !== initialOwner.identity
          || restoredOwner.instance !== initialOwner.instance || restoredOwner.revision !== initialOwner.revision
          || !restoredDigest || !sameDigests(restoredDigest, before)) throw new Error('verify');
        if (afterToken !== undefined) this.#host.discardSnapshot(afterToken);
        this.#host.discardSnapshot(beforeToken);
        return {status: 'blocked', reason: String(error).includes('mutation') ? 'mutation-rejected' : 'verification-failed'};
      } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
    }
  }

  unprotect(receipt: PersonalInfoProtectionReceiptB130): PersonalInfoProtectionTransitionB130 {
    return this.#restore(receipt, 'before');
  }

  reprotect(receipt: PersonalInfoProtectionReceiptB130): PersonalInfoProtectionTransitionB130 {
    return this.#restore(receipt, 'after');
  }

  #restore(
    receipt: PersonalInfoProtectionReceiptB130,
    target: ReceiptState,
  ): PersonalInfoProtectionTransitionB130 {
    if (this.#disposed) return {status: 'blocked', reason: 'session-ended'};
    if (!this.#host) return {status: 'blocked', reason: 'api-unavailable'};
    const entry = this.#entries.get(receipt);
    if (!entry) return {status: 'blocked', reason: 'unknown-receipt'};
    if (!editableContext(this.#context)) return {status: 'blocked', reason: 'invalid-context'};
    const expected = target === 'before' ? 'after' : 'before';
    if (entry.state !== expected) return {status: 'blocked', reason: 'history-state-mismatch'};
    const currentOwner = owner(this.#context), currentDigest = metadata(this.#host);
    const expectedDigest = expected === 'before' ? receipt.before : receipt.after;
    if (!currentOwner || !sameOwner(currentOwner, receipt, expected) || !currentDigest
      || !sameDigests(currentDigest, expectedDigest)) return {status: 'blocked', reason: 'history-state-mismatch'};
    try {
      const token = target === 'before' ? entry.beforeToken : entry.afterToken;
      if (!accepted(this.#host.restoreSnapshot(token))) throw new Error('restore');
      const restoredOwner = owner(this.#context), restoredDigest = metadata(this.#host);
      const targetDigest = target === 'before' ? receipt.before : receipt.after;
      if (!restoredOwner || !sameOwner(restoredOwner, receipt, target) || !restoredDigest
        || !sameDigests(restoredDigest, targetDigest)) throw new Error('verify');
      entry.state = target;
      return {status: target === 'before' ? 'unprotected' : 'reprotected', receipt};
    } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#host) {
      for (const entry of this.#entries.values()) {
        try { this.#host.discardSnapshot(entry.beforeToken); } catch { /* release only */ }
        try { this.#host.discardSnapshot(entry.afterToken); } catch { /* release only */ }
      }
    }
    this.#entries.clear();
  }
}
