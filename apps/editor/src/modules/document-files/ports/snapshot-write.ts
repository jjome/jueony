export interface SnapshotSinkPort {
 readBytes?(): Promise<Uint8Array>;
 open(): Promise<{write(bytes:Uint8Array):Promise<void>;close():Promise<void>;abort?():Promise<void>}>;
 readRememberedFingerprint(): string | undefined;
 rememberFingerprint(value: string): void;
}
export interface SnapshotWriteDependencies {
 revision(): string;
 fingerprint(bytes: Uint8Array): Promise<string>;
 beginSaving(): {finish():void};
}
