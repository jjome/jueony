// CJK bigrams with a separate unigram stream follow IeumOffice's tokenizer design.
// Copyright 2026 Mainfunc, Inc. Licensed under Apache-2.0. See THIRD_PARTY_NOTICES.md.
import type { SourceChunk } from '../public/contracts.ts';

const cjk = /^[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]$/u;
const word = /^[\p{L}\p{M}\p{N}]$/u;
const fold = (text: string) => text.normalize('NFKC').toLowerCase();
const phrase = /[\p{L}\p{M}\p{N}]+/gu;
const stop = new Set(['알려', '주세요', '얼마인가요', '언제인가요', '무엇인가요', '몇', '현재', '최신', '이전', '어느', '업무에서', '자료', '문서', '알려주세요']);
const datedMeeting = /(?:(20\d{2})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일[^\r\n]{0,12}(?:회의|협의)/u;

export function tokenizeForSearch(text: string): { bigrams: string[]; unigrams: string[] } {
  const bigrams: string[] = [];
  const unigrams: string[] = [];
  let run: string[] = [];
  let isCjk = false;
  const flush = () => {
    if (!run.length) return;
    if (!isCjk) {
      const term = run.join('');
      bigrams.push(term);
      unigrams.push(term);
    } else {
      unigrams.push(...run);
      if (run.length === 1) bigrams.push(run[0]);
      for (let index = 1; index < run.length; index++) bigrams.push(run[index - 1] + run[index]);
    }
    run = [];
  };
  for (const char of fold(text)) {
    const nextCjk = cjk.test(char);
    if (!nextCjk && !word.test(char)) { flush(); continue; }
    if (isCjk !== nextCjk) flush();
    isCjk = nextCjk;
    run.push(char);
  }
  flush();
  return { bigrams, unigrams };
}

function frequency(tokens: readonly string[]) {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

function documentHeading(header: string): string {
  return header.split(/\r?\n/u, 1)[0].replace(/^#+\s*/u, '').trim();
}

function namedProject(query: string): string | undefined {
  const match = /((?:[가-힣]{2,}[ \t]+){3,4})(?:사업|프로젝트)(?=\s|[의를은이과으로.,?!]|$)/u.exec(query);
  const leadingContext=/^(?:(?:현재|현행|확정(?:된|한)?|최신|올해|작년|해당|당시|있는|적용(?:한|했던|하던|되는)|초안(?:에서|의)?)[ \t]+)+/u;
  const name = match?.[1].trim().replace(leadingContext, '');
  if (name && name.split(/[ \t]+/u).length >= 3) return name.replace(/[ \t]+/gu, '');
}

function evidencePreference(query: string, header: string, body: string): number {
  const heading = documentHeading(header);
  const meeting = datedMeeting.exec(query);
  if (meeting && /회의|협의/u.test(heading)) {
    const date = /(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})/u.exec(heading);
    if (date && (!meeting[1] || date[1]===meeting[1])
      && Number(date[2])===Number(meeting[2]) && Number(date[3])===Number(meeting[3])) return 3;
  }
  if (/총\s*(?:예산|사업비)|예산(?:의)?\s*총액/u.test(query)) {
    if (/(?:예산|budget)/iu.test(heading)
      && /(?:총\s*(?:사업비|예산)|합계)(?:는|은|이|가)?[\s:：]*[\d,]+[ \t]*(?:원|만원)/u.test(body)) return 2;
  }
  const milestone = /(착수|시작|완료|종료)\s*(?:예정\s*)?(?:일자|날짜|일)(?![반정])/u.exec(query)?.[1];
  if (milestone && /일정|schedule/iu.test(heading)
    && new RegExp(`${milestone}(?:[ \\t]*(?:예정)?(?:일자|날짜|일))?(?:은|는|이|가)?[\\s:：]*20\\d{2}[./-]\\d{1,2}[./-]\\d{1,2}`, 'u').test(body)) return 1.8;
  return 1;
}

function headerStatus(header: string): string | undefined {
  return /(?:^|\|)[ \t]*상태[ \t]*:[ \t]*(current|superseded|draft)\b/imu.exec(header.slice(0,700))?.[1].toLowerCase();
}

function authorityPreference(query: string, firstChunk: string) {
  const status = headerStatus(firstChunk);
  const historical = /구본|구버전|이전|수정\s*전|적용하던|까지\s*적용/u.test(query);
  const current = /현재|최신|확정|현행|시행\s*(?:되는|중)|적용되는/u.test(query);
  if (historical) return status === 'superseded' ? 1.25 : 1;
  if (/초안/u.test(query)) return status === 'draft' ? 1.25 : 1;
  if (current) {
    if (status === 'current') return 1.25;
    if (status === 'superseded' || status === 'draft') return 0.55;
  }
  return 1;
}

function effectiveEditionPreferences(chunks:readonly SourceChunk[],query:string):Map<string,number> {
  const result=new Map<string,number>();
  if(!/현재|최신|현행|확정/u.test(query)||datedMeeting.test(query)
    ||/구본|구버전|이전|과거|당시|수정\s*전|초안|(?:적용|시행)\s*예정|20\d{2}\s*년/u.test(query))return result;
  const groups=new Map<string,{id:string;date:number;active:boolean}[]>();
  const now=new Date();
  const today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
  for(const chunk of chunks){
    if(chunk.start!==0)continue;
    const header=fold(chunk.text.slice(0,700));
    const status=headerStatus(header);
    const dates=[...header.matchAll(/(?:^|\|)[ \t]*(?:시행일|효력[ \t]*발생일|적용(?:기간)?)[ \t]*:[ \t]*(20\d{2})[.\/-][ \t]*(\d{1,2})[.\/-][ \t]*(\d{1,2})\.?(?:[ \t]*~[ \t]*(?:20\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2}|현재))?[ \t]*(?=\||\r?$)/gmu)];
    if(dates.length!==1)continue;
    const [,year,month,day]=dates[0],date=Date.UTC(Number(year),Number(month)-1,Number(day));
    const verified=new Date(date);
    if(verified.getUTCMonth()+1!==Number(month)||verified.getUTCDate()!==Number(day))continue;
    const title=fold(chunk.name).replace(/\.(?:hwpx?|docx|pdf|xlsx|txt|md)$/u,'');
    const family=title.replace(/(?:[ _-]+20\d{2}[._-]\d{1,2}[._-]\d{1,2}|[ _-]+v\d+(?:\.\d+)*)$/u,'').trim();
    if(!family)continue;
    const members=groups.get(family)??[];
    members.push({id:chunk.sourceId,date,active:status!=='draft'&&status!=='superseded'});groups.set(family,members);
  }
  for(const editions of groups.values()){
    if(editions.length<2)continue;
    const eligible=editions.filter(edition=>edition.active&&edition.date<=today);
    const latest=Math.max(...eligible.map(edition=>edition.date));
    if(!Number.isFinite(latest))continue;
    if(eligible.filter(edition=>edition.date===latest).length!==1)continue;
    for(const edition of editions)result.set(edition.id,edition.active&&edition.date===latest?1.35:edition.date>today?0.60:0.75);
  }
  return result;
}

function requiredEvidence(query: string): RegExp[] {
  const fields: RegExp[] = [];
  if (/주민\s*등록\s*번호/u.test(query)) fields.push(/(?<!\d)\d{6}\s*-?\s*[1-8]\d{6}(?!\d)/u);
  if (/(휴대\s*전화|휴대폰)\s*번호/u.test(query)) fields.push(/(?<!\d)01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}(?!\d)/u);
  if (/(api\s*(키|key)|접근\s*토큰).{0,8}(값|문자열)/iu.test(query)) {
    fields.push(/(?:api\s*(?:키|key)|접근\s*토큰)\s*[:=]\s*["']?(?!example|placeholder|your_|dummy|sample|fake)[a-z0-9_-]{16,}/iu);
  }
  return fields;
}

export function scoreKoreanBm25(chunks: readonly SourceChunk[], query: string, signal?: AbortSignal): number[] {
  const required = requiredEvidence(query);
  if (required.some(field => !chunks.some(chunk => field.test(chunk.text)))) return chunks.map(() => 0);
  const terms = [...new Set((fold(query).match(phrase) ?? []).filter(term => !stop.has(term)))].slice(0, 45);
  const queryTokens = [...new Set(terms.flatMap(term => tokenizeForSearch(term).bigrams))].slice(0, 160);
  const queryUnigrams = new Set(terms.filter(term => [...term].length === 1 && cjk.test(term)));
  const documents = chunks.map(chunk => {
    signal?.throwIfAborted();
    const title = tokenizeForSearch(chunk.name).bigrams;
    const body = tokenizeForSearch(chunk.text);
    return { chunk, title: frequency(title), body: frequency([...body.bigrams, ...body.unigrams.filter(token => queryUnigrams.has(token))]), length: body.bigrams.length };
  });
  const average = documents.reduce((total, doc) => total + doc.length, 0) / Math.max(1, documents.length) || 1;
  const documentFrequency = queryTokens.map(token => documents.filter(doc => doc.body.has(token) || doc.title.has(token)).length);
  const first = new Map(chunks.filter(chunk => chunk.start === 0).map(chunk => [chunk.sourceId, chunk.text]));
  const editionPreferences=effectiveEditionPreferences(chunks,query);
  const project = namedProject(query);
  if (project && !chunks.some(chunk=>fold(chunk.text).replace(/[ \t]+/gu,'').includes(project))) {
    return chunks.map(() => 0);
  }
  return documents.map(({chunk, title, body, length}) => {
    signal?.throwIfAborted();
    const normalized = `${fold(chunk.name)} ${fold(chunk.text)}`;
    const evidence = terms.filter(term => normalized.includes(term) || (term.length >= 3 && normalized.includes(term.slice(0, -1))));
    if (!evidence.length && !queryTokens.some(token => body.has(token) || title.has(token))) return 0;
    let score = 0;
    const saturation = 1.2 * (0.25 + 0.75 * length / average);
    for (let index = 0; index < queryTokens.length; index++) {
      const token = queryTokens[index];
      const tf = (body.get(token) ?? 0) + 2 * (title.get(token) ?? 0);
      if (!tf) continue;
      const df = documentFrequency[index];
      score += Math.log1p((documents.length - df + 0.5) / (df + 0.5)) * (2.2 * tf / (tf + saturation));
    }
    const year = /\b(20\d\d)\s*년/u.exec(query)?.[1];
    const header = first.get(chunk.sourceId) ?? '';
    const yearBonus = year && (chunk.name.includes(year) || header.slice(0, 600).includes(year)) ? 1.12 : 1;
    return score * (1 + evidence.length / Math.max(1, terms.length)) * authorityPreference(query, header) * yearBonus
      * (editionPreferences.get(chunk.sourceId)??1) * evidencePreference(query, header, chunk.text);
  });
}
