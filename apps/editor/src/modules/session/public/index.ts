export {orderRecoveredDocuments} from '../domain/document-order.ts';
export {createSessionGuard} from '../application/navigation.ts';
export {createSessionFacade} from '../application/facade.ts';
export {shouldProtectExit} from '../domain/exit-protection.ts';
export type {ExitProtectionState} from '../domain/exit-protection.ts';
export type {SessionFacade,SessionTab,SessionWorkspace,RecoveryDescriptor} from './contracts.ts';
export type {SessionLifecyclePort,SessionStatePort} from '../ports/lifecycle.ts';
