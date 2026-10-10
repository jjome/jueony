import {createOpenAIResponses} from './openai-responses.mjs';
import {createAnthropic} from './anthropic.mjs';
import {createGemini} from './gemini.mjs';
import {createHyperCLOVA} from './hyperclova.mjs';
import {createOpenAICompatible} from './openai-compatible.mjs';

export const providerRegistry=new Map([
 ['openai-responses',createOpenAIResponses],['anthropic',createAnthropic],['gemini',createGemini],
 ['hyperclova',createHyperCLOVA],['openai-compatible',createOpenAICompatible],
]);
