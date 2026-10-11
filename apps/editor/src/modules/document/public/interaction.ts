export type EditorCommand={id:string;label:string;shortcutLabel?:string;enabled:boolean};
export type EditorMenuItem={params?:Record<string,unknown>;commandId?:string;label:string;enabled:boolean;submenu?:EditorMenuItem[]};
export type EditorMenu={menuId:string;label:string;items:EditorMenuItem[]};
export interface DocumentInteractionFacade {
 prepareMenus?():Promise<void>;
 toolbarsVisible?():boolean;
 commands():EditorCommand[];
 menus():EditorMenu[];
 executeCommand(id:string,params?:Record<string,unknown>):{ok:boolean;message?:string;reason?:string};
 focusEditor():void;
}
