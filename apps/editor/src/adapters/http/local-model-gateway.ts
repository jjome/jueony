import type { ConnectionFacade, ConnectionList, ConnectionProbe, ModelConfig, ModelGatewayPort, ModelInput } from '../../modules/connections/public/index.ts';

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): value is JsonRecord => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The only frontend owner of the local AI server's session token and wire routes. */
export class LocalModelGateway implements ModelGatewayPort, ConnectionFacade {
  private token = '';
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
  async configure(config: ModelConfig, key: string | undefined, remember = false): Promise<{ configured: true }> {
    return await this.call('configure', { config, key, remember }) as { configured: true };
  }
  async generate(input: ModelInput, config: ModelConfig, signal: AbortSignal): Promise<unknown> {
    return (await this.call('generate', { configId: config.id, input }, signal)).result;
  }
}
