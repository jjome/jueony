// Compatibility entry: proposal validation and native execution have separate owners.
export {validateGeneration} from '../modules/agent/public/index.ts';
export {assertRevision} from '../modules/document/public/index.ts';
export {executeBodyOperations} from '../adapters/rhwp/body-operations.ts';
