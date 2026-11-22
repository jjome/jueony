import { connectionTestInput, assertConnectionTest } from './connection-test.mjs';
import { discoverLocalModels } from '../providers/local-model-discovery.mjs';
import {geminiOAuthEndpoint} from './gemini-oauth.mjs';

const restoreWarning = '저장된 연결을 복원하지 못했습니다. 다른 Windows 계정이거나 저장 파일이 손상되었을 수 있습니다. 키를 확인해 주세요.';
const safeError = message => Object.assign(new Error(message), { safeMessage: message });

/**
 * Application service. HTTP, files, DPAPI and provider construction are injected
 * at the server composition root; this module never reads environment or logs keys.
 * Registry factories implement generate(input, signal); store implements load/save/clear.
 */
export async function createModelService({ registry, connectionStore, maxActive = 2, checkEndpoint=()=>{}, geminiOAuth }) {
  const configs = new Map();
  let storageWarning = '', mutation = Promise.resolve(), active = 0;
  const serial = action => {
    const result = mutation.then(action);
    mutation = result.catch(() => {});
    return result;
  };
  function select(data, reuse = false) {
    const c = data.config;
    if (!c || typeof c.id !== 'string' || !c.id || c.id.length > 100 || !registry.has(c.adapterId) || typeof c.label !== 'string' || c.label.length > 200) {
      throw new Error('지원하지 않는 제공자 설정입니다.');
    }
    // Explicit fields prevent credentials/provider-specific fields reaching UI metadata.
    const config = { id: c.id, adapterId: c.adapterId, label: c.label, endpoint: c.endpoint, modelId: c.modelId, ...(c.maxOutputTokens !== undefined ? { maxOutputTokens: c.maxOutputTokens } : {}) };
    const previous = configs.get(config.id);
    let key = data.key;
    const savedOAuth=reuse?(key===undefined?previous?.oauth:undefined):data.oauth;
    if(savedOAuth){
      if(config.adapterId!=='gemini'||config.endpoint!==geminiOAuthEndpoint)throw safeError('Google 인증은 등록된 Gemini 주소에서만 사용할 수 있습니다.');
      const oauth=savedOAuth;
      if(!/^[a-f0-9]{64}$/u.test(oauth.binding)||typeof oauth.refresh!=='string'||!oauth.refresh||oauth.refresh.length>8192||/[^\x21-\x7e]/u.test(oauth.refresh)){
        throw safeError('저장된 Google 인증을 확인할 수 없습니다.');
      }
      const adapter=registry.get('gemini')(config,undefined,signal=>authorization(config.id,oauth,signal));
      return {adapter,config,oauth,remember:data.remember===true};
    }
    if (reuse && key === undefined) {
      if (!previous || ['adapterId', 'endpoint'].some(k => previous.config[k] !== config[k])) {
        throw safeError('주소·API 방식을 변경할 때는 새 API 키를 입력해 주세요.');
      }
      key = previous.key;
    }
    return { adapter: registry.get(config.adapterId)(config, key), config, key, remember: data.remember === true };
  }
  // Restore atomically: one bad entry preserves the store and blocks destructive writes.
  try {
    const restored = (await connectionStore.load()).map(record => select({ ...record, remember: true }));
    for (const selected of restored) configs.set(selected.config.id, selected);
  } catch { storageWarning = restoreWarning; }

  const recordsOf = collection => [...collection.values()].filter(c => c.remember).map(c => ({ config: c.config,
    ...(c.oauth?{oauth:{binding:c.oauth.binding,refresh:c.oauth.refresh}}:{key:c.key}) }));
  async function persist(records) {
    if (records.length) await connectionStore.save(records);
    else await connectionStore.clear();
  }
  function assertWritable() { if (storageWarning) throw safeError(storageWarning); }
  async function authorization(id,oauth,signal){
    if(!geminiOAuth?.available||geminiOAuth.binding!==oauth.binding)throw safeError('등록된 Google 데스크톱 앱으로 다시 인증해 주세요.');
    signal.throwIfAborted();
    if(!(oauth.tokens?.expiresAt>Date.now()+30_000)){
      oauth.refreshing??=(async()=>{
        const tokens=await geminiOAuth.authorization(oauth.refresh,AbortSignal.timeout(15000));
        if(tokens.refresh&&tokens.refresh!==oauth.refresh){
          await serial(async()=>{
            const current=configs.get(id);
            if(current?.oauth!==oauth)throw safeError('Google 연결이 변경됐습니다.');
            const previous=oauth.refresh;oauth.refresh=tokens.refresh;
            try{if(current.remember)await persist(recordsOf(configs));}
            catch(error){oauth.refresh=previous;throw error;}
          });
        }
        oauth.tokens=tokens;
      })().finally(()=>{oauth.refreshing=undefined;});
      await oauth.refreshing;
    }
    signal.throwIfAborted();
    if(configs.get(id)?.oauth!==oauth)throw safeError('Google 연결이 변경됐습니다.');
    return geminiOAuth.headers(oauth.tokens.access);
  }
  async function invoke(selected, input, signal, method = 'generate') {
    if (!selected) throw new Error('연결 설정에서 API 키를 등록해 주세요.');
    checkEndpoint(selected.config.endpoint);
    if (active >= maxActive) throw Object.assign(safeError('다른 AI 요청이 진행 중입니다.'), { statusCode: 429 });
    if (typeof selected.adapter[method] !== 'function') throw safeError('이 제공자는 문서 조회 도구를 지원하지 않습니다.');
    active++;
    try { return await selected.adapter[method](input, signal); }
    finally { active--; }
  }

  return {
    connections() {
      return {
        connections: [...configs.values()].map(c => ({ config: { ...c.config }, remember: c.remember, hasKey: Boolean(c.key||c.oauth),
          ...(c.oauth?{auth:'gemini-oauth'}:{}) })),
        secureStorage: connectionStore.available, warning: storageWarning,geminiOAuth:geminiOAuth?.available===true,
      };
    },
    beginGeminiOAuth(data){
      return serial(async()=>{
        assertWritable();
        if(!geminiOAuth?.available)throw safeError('Google 브라우저 인증이 설정되지 않았습니다.');
        if(data.remember===true&&!connectionStore.available)throw safeError('Windows 암호화 저장을 사용할 수 없습니다.');
        if(data.config?.adapterId!=='gemini'||data.config?.endpoint!==geminiOAuthEndpoint)throw safeError('Google 인증에는 공식 Gemini API 주소가 필요합니다.');
        const selected=select({config:data.config,key:'validation-only'});
        if([...configs.values()].some(value=>value.oauth&&value.config.id!==selected.config.id)){
          throw safeError('저장된 Google 연결을 선택해 다시 인증해 주세요.');
        }
        return geminiOAuth.begin(selected.config,data.remember===true);
      });
    },
    finishGeminiOAuth(id){
      return serial(async()=>{
        assertWritable();
        if(!geminiOAuth?.available||typeof id!=='string'||!id)throw safeError('Google 브라우저 인증이 설정되지 않았습니다.');
        const completion=geminiOAuth.take(id);
        if(!completion)return {status:'pending'};
        const {config,remember,tokens}=completion;
        const selected=select({config,remember,oauth:{binding:geminiOAuth.binding,refresh:tokens.refresh,tokens}});
        const next=new Map(configs);
        next.set(config.id,selected);
        if(remember||configs.get(config.id)?.remember)await persist(recordsOf(next));
        configs.set(config.id,selected);
        return {status:'connected',configId:config.id};
      });
    },
    cancelGeminiOAuth(id){
      if(typeof id==='string'&&id)geminiOAuth?.cancel(id);
      return {cancelled:true};
    },
    configure(data) {
      return serial(async () => {
        const selected = select(data, true);
        checkEndpoint(selected.config.endpoint);
        assertWritable();
        const next = new Map(configs);
        next.set(selected.config.id, selected);
        if (selected.remember || configs.get(selected.config.id)?.remember) await persist(recordsOf(next));
        configs.set(selected.config.id, selected);
        return { configured: true };
      });
    },
    removeConnection(configId) {
      return serial(async () => {
        assertWritable();
        const previous = configs.get(configId);
        if(previous?.oauth&&geminiOAuth?.available&&geminiOAuth.binding===previous.oauth.binding){
          await geminiOAuth.revoke(previous.oauth.refresh,AbortSignal.timeout(15000));
        }
        if (previous?.remember) {
          const next = new Map(configs);
          next.delete(configId);
          await persist(recordsOf(next));
        }
        configs.delete(configId);
        return { removed: true };
      });
    },
    clearCredentials() {
      return serial(async () => {
        geminiOAuth?.cancel();
        await connectionStore.clear();
        configs.clear();
        storageWarning = '';
        return { cleared: true };
      });
    },
    async testConnection(data, signal) {
      const selected = select(data, true);
      const method=typeof selected.adapter.testConnection==='function'?'testConnection':'generate';
      return assertConnectionTest(await invoke(selected, connectionTestInput(), signal,method));
    },
    async testDocumentTools(data, signal) {
      return invoke(select(data, true), undefined, signal, 'testDocumentTools');
    },
    async generate(configId, input, signal) {
      return { result: await invoke(configs.get(configId), input, signal) };
    },
    async generateDocumentToolTurn(configId, input, signal) {
      return { result: await invoke(configs.get(configId), input, signal, 'generateDocumentToolTurn') };
    },
    async discoverLocal(connection, signal) {
      checkEndpoint(connection?.endpoint);
      const previous=configs.get(connection?.configId);
      const key=connection?.key??(previous?.config.adapterId==='openai-compatible'&&previous.config.endpoint===connection?.endpoint?previous.key:'');
      return discoverLocalModels(connection?.endpoint,key,signal);
    },
  };
}
