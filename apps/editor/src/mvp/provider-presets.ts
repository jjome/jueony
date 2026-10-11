import type {ModelConfig} from '../modules/connections/public/index.ts';

export const providerPresets:Record<ModelConfig['adapterId'],{name:string;endpoint:string;model:string;hint:string;keyHint:string}>={
 'openai-responses':{name:'GPT · OpenAI',endpoint:'https://api.openai.com/v1',model:'',hint:'OpenAI Responses API로 연결합니다. 계정에서 사용 가능한 구조화 출력 지원 모델 ID를 입력하세요. Endpoint는 /v1까지 입력합니다.',keyHint:'OpenAI API 키'},
 anthropic:{name:'Claude · Anthropic',endpoint:'https://api.anthropic.com/v1',model:'',hint:'Anthropic Messages API로 연결합니다. 계정에서 사용 가능한 구조화 출력 지원 Claude 모델 ID를 입력하세요. Endpoint는 /v1까지 입력합니다.',keyHint:'Anthropic API 키'},
 gemini:{name:'Gemini · Google',endpoint:'https://generativelanguage.googleapis.com/v1beta',model:'',hint:'Google AI Studio API 키로 Generate Content API에 연결합니다. 모델 ID는 models/ 없이 입력하세요. Endpoint는 /v1beta까지 입력합니다. Vertex AI 인증은 지원하지 않습니다.',keyHint:'Google AI Studio API 키'},
 hyperclova:{name:'HyperCLOVA X · NAVER',endpoint:'https://clovastudio.stream.ntruss.com/v3/chat-completions',model:'HCX-005',hint:'일반 NAVER Cloud · HCX-005 / HCX-007 지원. 서비스 앱에서 승인된 모델을 선택하세요. Endpoint는 /v3/chat-completions까지 입력합니다. HCX-005 출력 토큰: 1,024~4,096.',keyHint:'CLOVA Studio API 키'},
 'openai-compatible':{name:'OpenAI 호환 서버',endpoint:'',model:'',hint:'Chat Completions 호환 서버를 연결합니다. Endpoint는 /v1까지 입력합니다. GPT 공식 API는 GPT · OpenAI를 선택하세요.',keyHint:'인증이 없는 로컬 서버는 비워 둘 수 있습니다.'},
};
