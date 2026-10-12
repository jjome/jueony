export type EditorCommand={id:string;label:string;shortcutLabel?:string;enabled:boolean};
export type EditorMenuItem={params?:Record<string,unknown>;commandId?:string;label:string;enabled:boolean;submenu?:EditorMenuItem[]};
export type EditorMenu={menuId:string;label:string;items:EditorMenuItem[]};
/** Values displayed by the reused native formatting bar; no DOM/engine handles. */
export type EditorFormattingState={visible:boolean;enabled:boolean;fontEnabled:boolean;revision:string;documentIdentity:string;selectionToken:string;styleId:number|null;fontFamily:string;sizePt:number|null;language:'all'|number;bold:boolean;italic:boolean;underline:boolean;alignment:string|null;fonts:string[]};
export interface DocumentInteractionFacade {
 prepareMenus?():Promise<void>;
 toolbarsVisible?():boolean;
 formattingState?():EditorFormattingState;
 commands():EditorCommand[];
 menus():EditorMenu[];
 executeCommand(id:string,params?:Record<string,unknown>):{ok:boolean;message?:string;reason?:string};
 focusEditor():void;
}
