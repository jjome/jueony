import type {Snapshot} from '../public/types.ts';

export function agentStoredCharacterStyle(target:string,properties:Record<string,unknown>,snapshot:Snapshot){
  const value=properties.storedStyle;
  if(Object.keys(properties).length!==1||!value||typeof value!=='object'||Array.isArray(value)||
     Object.keys(value).length!==4||Object.keys(value).some(key=>!['styleId','start','count','originalText'].includes(key))){
    throw new Error('저장 글자 스타일과 직접 서식을 한 명령에서 섞을 수 없습니다.');
  }
  const {styleId,start,count,originalText}=value as {styleId:number;start:number;count:number;originalText:string};
  if(![styleId,start,count].every(Number.isSafeInteger)||styleId<0||styleId>255||start<0||count<1||count>4000||
     typeof originalText!=='string'||/\p{Cc}/u.test(originalText)){
    throw new Error('저장 글자 스타일의 원문과 Unicode 글자 범위를 지정하세요.');
  }
  const node=snapshot.nodes.find(node=>node.id===target);
  const reference=snapshot.structure?.storedCharacterStyles?.[styleId];
  const characters=node?Array.from(node.text):[];
  if(!node?.editable||!reference||reference.styleId!==styleId||start+count>characters.length||
     characters.slice(start,start+count).join('')!==originalText){
    throw new Error('저장 글자 스타일 정의나 본문 원문·범위가 확인되지 않았습니다.');
  }
  return {node,reference,start,count};
}
