import {
  USER_PROFILE_FORMAT_B150,
  USER_PROFILE_VERSION_B150,
  UserProfileErrorB150,
  captureUserProfileB150,
  exportUserProfileB150,
  importUserProfileB150,
  mergeUserProfilesB150,
  type UserProfileB150,
  type UserProfilePolicyB150,
  type UserProfileScopeB150,
} from '../../modules/preferences/public/index.ts';

export interface AtomicProfileRecordStoreB150 {
  read(key: string): Promise<string | null>;
  /** Must atomically replace only when the current raw value equals expectedRaw. */
  compareAndSwap(key: string, expectedRaw: string | null, nextRaw: string | null): Promise<boolean>;
}

export type UserProfileRepositoryErrorCodeB150 =
  | 'stale' | 'corrupt' | 'write' | 'verification' | 'rollback-failed';

export class UserProfileRepositoryErrorB150 extends Error {
  readonly code: UserProfileRepositoryErrorCodeB150;
  constructor(code: UserProfileRepositoryErrorCodeB150, message = code) {
    super(message);
    this.code = code;
    this.name = 'UserProfileRepositoryErrorB150';
  }
}

export interface UserProfileRepositoryOptionsB150 {
  store: AtomicProfileRecordStoreB150;
  policy: UserProfilePolicyB150;
  verifyWrite?: (profile: UserProfileB150, raw: string) => void | Promise<void>;
}

function storageKey(scope: UserProfileScopeB150, profileId: string): string {
  return `jueony:user-profile:v1:${scope}:${profileId}`;
}

function emptyProfile(scope: UserProfileScopeB150, profileId: string): UserProfileB150 {
  return { format: USER_PROFILE_FORMAT_B150, version: USER_PROFILE_VERSION_B150, scope, profileId, revision: 0, menu: [], toolbar: [], keymap: [] };
}

export function createAtomicUserProfileRepositoryB150(options: UserProfileRepositoryOptionsB150) {
  async function read(scope: UserProfileScopeB150, profileId: string): Promise<UserProfileB150> {
    const identity = captureUserProfileB150(emptyProfile(scope, profileId), options.policy);
    const raw = await options.store.read(storageKey(identity.scope, identity.profileId));
    if (raw === null) return identity;
    try {
      const stored = importUserProfileB150(raw, options.policy);
      if (stored.scope !== identity.scope || stored.profileId !== identity.profileId) throw new UserProfileRepositoryErrorB150('corrupt');
      return stored;
    } catch (error) {
      if (error instanceof UserProfileRepositoryErrorB150) throw error;
      throw new UserProfileRepositoryErrorB150('corrupt');
    }
  }

  async function mergeImport(args: {
    scope: UserProfileScopeB150;
    profileId: string;
    expectedRevision: number;
    portableJson: string;
  }): Promise<UserProfileB150> {
    const requested = captureUserProfileB150(emptyProfile(args.scope, args.profileId), options.policy);
    const incoming = importUserProfileB150(args.portableJson, options.policy);
    if (incoming.scope !== requested.scope || incoming.profileId !== requested.profileId) throw new UserProfileErrorB150('identity');
    const key = storageKey(requested.scope, requested.profileId);
    const previousRaw = await options.store.read(key);
    let current: UserProfileB150;
    try { current = previousRaw === null ? requested : importUserProfileB150(previousRaw, options.policy); }
    catch { throw new UserProfileRepositoryErrorB150('corrupt'); }
    if (current.scope !== requested.scope || current.profileId !== requested.profileId) throw new UserProfileRepositoryErrorB150('corrupt');
    if (current.revision !== args.expectedRevision) throw new UserProfileRepositoryErrorB150('stale');
    const merged = mergeUserProfilesB150(current, incoming, options.policy);
    const next = captureUserProfileB150({ ...merged, revision: current.revision + 1 }, options.policy);
    const nextRaw = exportUserProfileB150(next, options.policy);
    let swapped: boolean;
    try { swapped = await options.store.compareAndSwap(key, previousRaw, nextRaw); }
    catch { throw new UserProfileRepositoryErrorB150('write'); }
    if (!swapped) throw new UserProfileRepositoryErrorB150('stale');
    try {
      const observedRaw = await options.store.read(key);
      if (observedRaw !== nextRaw) throw new UserProfileRepositoryErrorB150('verification');
      await options.verifyWrite?.(next, nextRaw);
      return next;
    } catch (error) {
      let rolledBack = false;
      try { rolledBack = await options.store.compareAndSwap(key, nextRaw, previousRaw); }
      catch { /* handled below */ }
      if (!rolledBack) throw new UserProfileRepositoryErrorB150('rollback-failed');
      if (error instanceof UserProfileRepositoryErrorB150) throw error;
      throw new UserProfileRepositoryErrorB150('verification');
    }
  }

  return { read, mergeImport };
}

