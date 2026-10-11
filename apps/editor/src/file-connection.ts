// Legacy persistence DTO contains browser handles; keep it inside adapters.
export {captureFileConnection,restoreFileConnection} from './adapters/files/file-connection.ts';
export type {RestorableFileHandle,StoredFileConnection,FileConnectionResult} from './adapters/files/file-connection.ts';
