import type { ConnectionFacade, ConnectionList, ConnectionProbe, DocumentToolInput, GeminiOAuthResult, ModelConfig, ModelGatewayPort, ModelInput } from '../../modules/connections/public/index.ts';
import {tokenizeForSearch,type RankedIndexPort,type RetrievalIndex,type RetrievalScope} from '../../modules/references/public/index.ts';
import {institutionOffline} from '../../mvp/institution-policy.ts';

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): value is JsonRecord => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The only frontend owner of the local AI server's session token and wire routes. */
export class LocalModelGateway implements ModelGatewayPort, ConnectionFacade, RankedIndexPort {
  private token = '';
  private indexRequests: Promise<unknown> = Promise.resolve();
  private readonly request: typeof fetch;

  constructor(request: typeof fetch = globalThis.fetch.bind(globalThis)) { this.request = request; }

  async connect(): Promise<void> {
    const response = await this.request('/api/session', { headers: { 'X-Jueony-Bootstrap': '1' } });
    if (!response.ok) throw new Error('새 Jueony 실행기로 다시 시작해야 AI 연결을 사용할 수 있습니다.');
    const value: unknown = await response.json();
    if (!record(value) || value.documentControlVersion !== 1 || value.providerCatalogVersion !== 1 || typeof value.token !== 'string' || !value.token) {
      throw new Error('이전 AI 서버가 실행 중입니다. 문서를 저장하고 창을 닫은 뒤 Restart-Jueony.cmd로 다시 실행하세요.');
    }
    this.token = value.token;
  }

  private async call(path: string, body: unknown, signal?: AbortSignal): Promise<JsonRecord> {
    if (!this.token) await this.connect();
    const response = await this.request('/api/' + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Jueony-Token': this.token },
      body: JSON.stringify(body), signal,
    });
    const result: unknown = await response.json();
    if (!response.ok) throw new Error(record(result) && typeof result.error === 'string' ? result.error : 'AI 연결 실패');
    if (!record(result)) throw new Error('AI 서버 응답 형식이 올바르지 않습니다.');
    return result;
  }

  async testConnection(config: ModelConfig, key: string | undefined, signal?: AbortSignal): Promise<ConnectionProbe> {
    return await this.call('test-connection', { config, key }, signal) as ConnectionProbe;
  }
  async connections(): Promise<ConnectionList> { return await this.call('connections', {}) as ConnectionList; }
  async removeConnection(configId: string): Promise<{ removed: true }> { return await this.call('remove-connection', { configId }) as { removed: true }; }
  async clearCredentials(): Promise<{ cleared: true }> { return await this.call('clear-credentials', {}) as { cleared: true }; }
  async startGeminiOAuth(config:ModelConfig,remember:boolean):Promise<{id:string;url:string}> {
    if(institutionOffline)throw new Error('기관 오프라인 빌드에서는 외부 계정 인증을 열 수 없습니다.');
    const result=await this.call('gemini-oauth/start',{config,remember});
    if(typeof result.id!=='string'||typeof result.url!=='string')throw new Error('Google 인증 링크를 확인할 수 없습니다.');
    const url=new URL(result.url);
    if(url.origin!=='https://accounts.google.com'||url.pathname!=='/o/oauth2/v2/auth'||url.username||url.password||url.hash){
      throw new Error('공식 Google 인증 링크만 열 수 있습니다.');
    }
    return {id:result.id,url:url.href};
  }
  async finishGeminiOAuth(id:string):Promise<GeminiOAuthResult> {
    const result=await this.call('gemini-oauth/finish',{id});
    if(result.status==='pending')return {status:'pending'};
    if(result.status==='connected'&&typeof result.configId==='string')return {status:'connected',configId:result.configId};
    throw new Error('Google 인증 결과를 확인할 수 없습니다.');
  }
  async cancelGeminiOAuth(id:string):Promise<void> { await this.call('gemini-oauth/cancel',{id}); }
  async discoverLocal(endpoint: string, configId?: string, key?: string, signal?: AbortSignal): Promise<{kind:'openai-compatible'|'ollama';models:string[]}> {
    const value=await this.call('discover-local-models',{endpoint,configId,key},signal);
    if((value.kind!=='openai-compatible'&&value.kind!=='ollama')||!Array.isArray(value.models)||value.models.some(id=>typeof id!=='string')) {
      throw new Error('서버의 모델 목록 형식을 확인하지 못했습니다.');
    }
    return {kind:value.kind,models:value.models as string[]};
  }
  async testDocumentTools(config: ModelConfig, key: string | undefined, signal?: AbortSignal): Promise<{supported:boolean}> {
    const value=await this.call('test-document-tools',{config,key},signal);
    if(typeof value.supported!=='boolean')throw new Error('모델의 도구 지원 결과를 읽을 수 없습니다.');
    return {supported:value.supported};
  }
  async configure(config: ModelConfig, key: string | undefined, remember = false): Promise<{ configured: true }> {
    return await this.call('configure', { config, key, remember }) as { configured: true };
  }
  async generate(input: ModelInput, config: ModelConfig, signal: AbortSignal): Promise<unknown> {
    return (await this.call('generate', { configId: config.id, input }, signal)).result;
  }
  async generateDocumentToolTurn(input: DocumentToolInput, config: ModelConfig, signal: AbortSignal): Promise<unknown> {
    return (await this.call('document-tool-turn', { configId: config.id, input }, signal)).result;
  }
  async rank(index: RetrievalIndex, query: string, signal?: AbortSignal): Promise<ReadonlyMap<string, number>> {
    const eligible = index.chunks.filter(chunk => !chunk.sourceId.startsWith('attachment:')
      && !chunk.limitation?.startsWith('열린 문서의 미저장'));
    const tokens = (value: string) => tokenizeForSearch(value).bigrams.filter(token => [...token].length <= 80);
    const chunks = eligible.map(chunk => ({ id: chunk.id.slice(6), title: tokens(chunk.name).slice(0, 250), body: tokens(chunk.text) }));
    const allowed = new Set(chunks.map(chunk => chunk.id));
    const result = await this.queueIndex(() => {
      signal?.throwIfAborted();
      return this.call('reference-index/search', { workspaceId:index.workspaceId, chatId:index.chatId,
        chunks, query:[...new Set(tokens(query))].slice(0,160) });
    });
    signal?.throwIfAborted();
    if (!Array.isArray(result.hits) || result.hits.some(hit => !record(hit) || typeof hit.id !== 'string' || !allowed.has(hit.id))) {
      throw new Error('검색 색인의 자료 범위가 일치하지 않습니다.');
    }
    return new Map(result.hits.map((hit, position) => [`chunk:${hit.id}`, position]));
  }
  async clear(scope: Pick<RetrievalScope,'workspaceId'> & Partial<Pick<RetrievalScope,'chatId'>>): Promise<void> {
    await this.queueIndex(() => this.call('reference-index/clear', scope));
  }
  private queueIndex<T>(action:()=>Promise<T>):Promise<T> {
    // Keep the server-side write and the following clear in this order even if a selection is revoked mid-flight.
    const result=this.indexRequests.then(action);
    this.indexRequests=result.catch(()=>{});
    return result;
  }
}
