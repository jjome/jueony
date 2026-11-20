export {orderRecoveredDocuments} from '../domain/document-order.ts';
export {documentTabCycleTarget} from '../domain/document-tab-cycle.ts';
export {createSessionGuard} from '../application/navigation.ts';
export {createSessionFacade} from '../application/facade.ts';
export {shouldProtectExit} from '../domain/exit-protection.ts';
export type {ExitProtectionState} from '../domain/exit-protection.ts';
export type {SessionFacade,SessionTab,SessionWorkspace,RecoveryDescriptor} from './contracts.ts';
export type {SessionLifecyclePort,SessionStatePort} from '../ports/lifecycle.ts';
export {coordinateUndoLifecycleN018} from '../application/undo-lifecycle-coordinator-n018.ts';
export type {
  UndoHistoryCommandN018,
  UndoHistoryPortN018,
  UndoLifecycleBoundaryN018,
  UndoLifecycleResultN018,
} from '../application/undo-lifecycle-coordinator-n018.ts';
export {validateAtomicUndoRecipe} from '../domain/undo-lifetime.ts';
export type {AtomicUndoRecipe} from '../domain/undo-lifetime.ts';
