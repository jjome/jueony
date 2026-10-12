import {documentTabCycleTarget} from '../../modules/session/public/index.ts';
import type {SessionTab} from '../../modules/session/public/index.ts';
import type {DocumentViewState} from '../../modules/preferences/public/index.ts';

export type DocumentTabKey = Pick<KeyboardEvent,'key'|'code'|'ctrlKey'|'shiftKey'|'altKey'|'metaKey'|'isComposing'|'keyCode'|'repeat'|'isTrusted'|'defaultPrevented'>;
export function documentTabKeyDirection(event:DocumentTabKey):1|-1|undefined {
 if(!event.isTrusted||event.defaultPrevented||event.isComposing||event.keyCode===229||!event.ctrlKey||event.altKey||event.metaKey
   ||(event.key!=='Tab'&&event.code!=='Tab'))return;
 return event.shiftKey?-1:1;
}
export interface DocumentTabCycleOptions {
 source:Window;
 sourceDocument:Document;
 sourceId:string;
 sourceWorkspaceId:string;
 /** Include only initialized tabs, in the actual displayed order. */
 tabs():readonly SessionTab[];
 activeId():string|undefined;
 workspaceId():string;
 captureView():DocumentViewState|undefined;
 blocked():boolean;
 /** Compose the existing Session selection, view suspension and persistence. */
 activate(targetId:string):void;
 /** Called synchronously only as a consequence of the trusted document key. */
 focus(targetId:string):void;
}
/** Same-origin iframe DOM adapter. No postMessage or private engine access is needed. */
export function installDocumentTabCycle(options:DocumentTabCycleOptions):()=>void {
 const listener=(event:KeyboardEvent)=>{
  const direction=documentTabKeyDirection(event);if(direction===undefined||options.blocked()||options.activeId()!==options.sourceId||options.workspaceId()!==options.sourceWorkspaceId)return;
  const doc=options.sourceDocument,target=event.target as Element|null;
  if(doc.querySelector('.modal-overlay,dialog[open]')||target?.ownerDocument!==doc||target?.getAttribute?.('aria-label')!=='문서 편집 입력')return;
  const cursor=options.captureView()?.cursor;
  // Tables own Ctrl+Tab (literal tab) / Ctrl+Shift+Tab (quick hanging indent).
  // Missing, transient, object and special-story bookmarks cannot masquerade as body context.
  if(cursor?.kind!=='text'||cursor.focus.kind!=='body')return;
  const targetId=documentTabCycleTarget(options.tabs(),options.workspaceId(),options.sourceId,direction);if(!targetId)return;
  event.preventDefault();event.stopImmediatePropagation();options.activate(targetId);
  if(options.activeId()===targetId&&options.workspaceId()===options.sourceWorkspaceId)options.focus(targetId);
 };
 options.source.addEventListener('keydown',listener,true);
 return ()=>options.source.removeEventListener('keydown',listener,true);
}
