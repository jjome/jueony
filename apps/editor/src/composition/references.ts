import {createReferenceFacade} from '../modules/references/public/index.ts';
import {browserContentHash} from '../adapters/browser/content-hash.ts';
export const references=createReferenceFacade(browserContentHash);
