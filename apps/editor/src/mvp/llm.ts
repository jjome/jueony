/** Legacy import seam. New consumers use the Connections contract and composition root. */
export type { ModelInput as LLMInput, ModelGatewayPort as LLMPort } from '../modules/connections/public/index.ts';
export { LocalModelGateway as LocalLLMPort } from '../adapters/http/local-model-gateway.ts';
