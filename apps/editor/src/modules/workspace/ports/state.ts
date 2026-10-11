import type { WorkspaceState } from '../public/contracts.ts';

/** A shared state owner supplies the current workspace slice; the module never replaces the aggregate. */
export interface WorkspaceStatePort { current(): WorkspaceState }
export interface WorkspaceIdPort { next(): string }
