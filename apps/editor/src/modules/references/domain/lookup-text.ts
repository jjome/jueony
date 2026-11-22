/** Match folded text while returning the original UTF-16 coordinates used by citations. */
export function findSourceTextOffset(text:string,query:string):number{
  const normalized=text.normalize('NFKC');
  const folded=normalized.toLowerCase();
  const found=folded.indexOf(query);
  if(found<0||normalized===text&&folded.length===text.length)return found;

  let position=0;
  for(const {segment,index} of new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(text)){
    position+=segment.normalize('NFKC').toLowerCase().length;
    if(position>found)return index;
  }
  return -1;
}
