/** Keep workspace tab order without dropping legacy or orphaned recovery records. */
export function orderRecoveredDocuments<T extends {id:string}>(documents:T[], order?:string[]):T[]{
 const rank=new Map<string,number>();
 for(const id of order??[])if(!rank.has(id))rank.set(id,rank.size);
 return documents.map((doc,index)=>({doc,index})).sort((a,b)=>
  (rank.get(a.doc.id)??Number.MAX_SAFE_INTEGER)-(rank.get(b.doc.id)??Number.MAX_SAFE_INTEGER)||a.index-b.index
 ).map(item=>item.doc);
}
