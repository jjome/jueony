import { connectionTestInput, assertConnectionTest } from './connection-test.mjs';

const restoreWarning = '저장된 연결을 복원하지 못했습니다. 다른 Windows 계정이거나 저장 파일이 손상되었을 수 있습니다. 키를 확인해 주세요.';
const safeError = message => Object.assign(new Error(message), { safeMessage: message });

/**
 * Application service. HTTP, files, DPAPI and provider construction are injected
 * at the server composition root; this module never reads environment or logs keys.
 * Registry factories implement generate(input, signal); store implements load/save/clear.
 */
export async function createModelService({ registry, connectionStore, maxActive = 2 }) {
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

  const recordsOf = collection => [...collection.values()].filter(c => c.remember).map(c => ({ config: c.config, key: c.key }));
  async function persist(records) {
    if (records.length) await connectionStore.save(records);
    else await connectionStore.clear();
  }
  function assertWritable() { if (storageWarning) throw safeError(storageWarning); }
  async function invoke(selected, input, signal) {
    if (!selected) throw new Error('연결 설정에서 API 키를 등록해 주세요.');
    if (active >= maxActive) throw Object.assign(safeError('다른 AI 요청이 진행 중입니다.'), { statusCode: 429 });
    active++;
    try { return await selected.adapter.generate(input, signal); }
    finally { active--; }
  }

  return {
    connections() {
      return {
        connections: [...configs.values()].map(c => ({ config: { ...c.config }, remember: c.remember, hasKey: Boolean(c.key) })),
        secureStorage: connectionStore.available, warning: storageWarning,
      };
    },
    configure(data) {
      return serial(async () => {
        const selected = select(data, true);
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
        await connectionStore.clear();
        configs.clear();
        storageWarning = '';
        return { cleared: true };
      });
    },
    async testConnection(data, signal) {
      const selected = select(data, true);
      return assertConnectionTest(await invoke(selected, connectionTestInput(), signal));
    },
    async generate(configId, input, signal) {
      return { result: await invoke(configs.get(configId), input, signal) };
    },
  };
}
