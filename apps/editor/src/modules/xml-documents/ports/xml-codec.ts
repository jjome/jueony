import type {XmlElementValue} from '../public/contracts.ts';
export interface XmlCodecPort {
 parse(source:string):XmlElementValue;
 replaceText(source:string,path:readonly number[],text:string):string;
 repeat(source:string,path:readonly number[]):string;
 remove(source:string,path:readonly number[]):string;
}
