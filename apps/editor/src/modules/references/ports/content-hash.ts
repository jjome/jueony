export interface ContentHashPort { digest(text:string):Promise<string>; }
