import { ConfigService } from '@nestjs/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { Logger } from '@nestjs/common';
import { GEMINI_MODEL } from './ai.constants';

// Token để inject — dùng string token thay vì class
// để tránh circular dependency và dễ mock khi test
export const GEMINI_CHAT_MODEL = 'GEMINI_CHAT_MODEL';
export const GEMINI_EMBEDDINGS = 'GEMINI_EMBEDDINGS';
export const GEMINI_STABLE_MODEL = 'GEMINI_STABLE_MODEL'; // temperature=0 cho JSON output

export const AiProviders = [
  {
    provide: GEMINI_CHAT_MODEL,
    inject: [ConfigService],
    useFactory: (config: ConfigService) => {
      const apiKey = config.get<string>('GEMINI_API_KEY') || '';
      if (!apiKey) {
        new Logger('AiProvider').warn(
          'GEMINI_API_KEY chưa được cấu hình – ChatModel sẽ không hoạt động.',
        );
      }
      return new ChatGoogleGenerativeAI({
        apiKey: apiKey || 'missing-gemini-api-key',
        model: GEMINI_MODEL,
        temperature: 0.2,
        maxRetries: 1,
      });
    },
  },

  {
    provide: GEMINI_STABLE_MODEL,
    inject: [ConfigService],
    useFactory: (config: ConfigService) => {
      const apiKey = config.get<string>('GEMINI_API_KEY') || '';
      // temperature=0 — dùng cho analyzeSentiment và translateMessage
      // cần output JSON ổn định, không sáng tạo
      return new ChatGoogleGenerativeAI({
        apiKey: apiKey || 'missing-gemini-api-key',
        model: GEMINI_MODEL,
        temperature: 0,
        maxRetries: 1,
      });
    },
  },

  {
    provide: GEMINI_EMBEDDINGS,
    inject: [ConfigService],
    useFactory: (config: ConfigService) => {
      const apiKey = config.get<string>('GEMINI_API_KEY') || '';
      return new GoogleGenerativeAIEmbeddings({
        apiKey: apiKey || 'missing-gemini-api-key',
        model: 'gemini-embedding-2',
        maxRetries: 1,
      });
    },
  },
];
