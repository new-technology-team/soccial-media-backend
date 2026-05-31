import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";

import {
  GEMINI_CHAT_MODEL,
  GEMINI_STABLE_MODEL,
} from './ai.provider';
import { ConfigService } from "@nestjs/config";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { GEMINI_MODEL } from "./ai.constants";

export interface TranslateResult {
  translatedText: string;
  detectedLanguage: string; // mã ISO: vi, en
  detectedLanguageName: string; // tên tiếng Việt: Tiếng Anh
  targetLanguage: string; // ngôn ngữ đích user yêu cầu
  isSameLanguage: boolean; // true nếu tin nhắn đã là ngôn ngữ đích
}

export interface SentimentResult {
  sentiment: "positive" | "neutral" | "negative";
  score: number; // 0.0 → 1.0
  detail: string; // mô tả ngắn tiếng Việt
  emotions: string[]; // tối đa 3 cảm xúc cụ thể
}

export interface ChatMessageSummaryInput {
  sender: string;
  content: string;
  timestamp?: Date | string;
}

@Injectable()
export class ChatAnalysisService {
  private readonly logger = new Logger(ChatAnalysisService.name);

  constructor(private readonly config: ConfigService,  // ✅ Inject model thường cho summarize và suggestReplies
    @Inject(GEMINI_CHAT_MODEL)
    private readonly chatModel: ChatGoogleGenerativeAI,

    // ✅ Inject stable model cho analyzeSentiment và translateMessage
    @Inject(GEMINI_STABLE_MODEL)
    private readonly stableModel: ChatGoogleGenerativeAI,) {

  }

  /**
   * Feature 2: Tóm tắt tin nhắn lịch sử
   * Phân tích và tóm tắt lại cuộc hội thoại dựa trên một danh sách các tin nhắn được cung cấp.
   * Thường số lượng tin nhắn này được fetch từ MongoDB của module Messages/Conversations.
   */
  async summarizeChat(
    messages: ChatMessageSummaryInput[],
  ): Promise<{ summary: string }> {
    if (!messages || messages.length === 0) {
      return { summary: "Không có đoạn chat nào để tóm tắt." };
    }

    try {
      const promptTemplate = PromptTemplate.fromTemplate(`
Bạn là một chuyên gia phân tích và tóm tắt dữ liệu hội thoại chat.
Dưới đây là một đoạn hội thoại giữa các thành viên. Hãy tóm tắt ngắn gọn các thông tin sau:
1. Nội dung chính của cuộc trò chuyện.
2. Các quyết định được đưa ra (nếu có).
3. Các công việc cần làm tiếp theo hoặc thông tin quan trọng cần lưu ý (nếu có).

Hãy tóm tắt ngắn gọn, dễ đọc bằng tiếng Việt, dưới dạng gạch đầu dòng nếu cần thiết.

NỘI DUNG HỘI THOẠI:
{chat_history}

TÓM TẮT CỦA BẠN:
      `);

      // Tiền xử lý lịch sử tin nhắn thành văn bản dễ đọc
      const formattedHistory = messages
        .map(
          (m) =>
            `[${m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : "N/A"}] ${m.sender}: ${m.content}`,
        )
        .join("\n");

      this.logger.debug(
        `Đang tiến hành tóm tắt cuộc hội thoại (${messages.length} tin nhắn)...`,
      );

      // LangChain Expression Language (LCEL) chain
      const chain = promptTemplate
        .pipe(this.chatModel)
        .pipe(new StringOutputParser());

      const summary = await chain.invoke({
        chat_history: formattedHistory,
      });

      return { summary };
    } catch (error) {
      this.logger.error(
        "Lỗi khi ứng dụng tóm tắt tin nhắn (ChatAnalysis):",
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException(
        "Đã xảy ra lỗi trong quá trình phân tích và tóm tắt tin nhắn.",
      );
    }
  }

  /**
   * Feature 3: Smart Reply — Gợi ý 3 câu trả lời nhanh
   * Dựa vào lịch sử hội thoại gần nhất, gợi ý các câu trả lời
   * phù hợp ngữ cảnh cho người dùng hiện tại.
   */
  async suggestReplies(
    messages: ChatMessageSummaryInput[],
    currentUserName: string,
  ): Promise<{ suggestions: string[] }> {
    if (!messages || messages.length === 0) {
      return { suggestions: [] };
    }

    try {
      const promptTemplate = PromptTemplate.fromTemplate(`
Bạn là trợ lý gợi ý tin nhắn thông minh trong ứng dụng chat ZChat.

Dưới đây là đoạn hội thoại gần nhất. Hãy gợi ý đúng 3 câu trả lời ngắn gọn,
tự nhiên bằng tiếng Việt cho người dùng tên "{currentUser}".

Yêu cầu:
- Mỗi gợi ý trên 1 dòng riêng biệt.
- Không đánh số, không thêm dấu gạch đầu dòng, không giải thích thêm.
- Gợi ý phải đa dạng: 1 đồng ý/tích cực, 1 hỏi thêm, 1 trung lập hoặc hài hước.
- Độ dài mỗi gợi ý từ 3 đến 15 từ, phù hợp văn phong chat.
- Chỉ trả về đúng 3 dòng, không thêm bất cứ thứ gì khác.

HỘI THOẠI GẦN NHẤT:
{chatHistory}

3 GỢI Ý CHO {currentUser}:
    `);

      // Chỉ lấy 10 tin nhắn gần nhất để tránh prompt quá dài
      const recentMessages = messages.slice(-10);
      const formattedHistory = recentMessages
        .map((m) => `${m.sender}: ${m.content}`)
        .join("\n");

      const chain = promptTemplate
        .pipe(this.chatModel)
        .pipe(new StringOutputParser());

      const result = await chain.invoke({
        chatHistory: formattedHistory,
        currentUser: currentUserName,
      });

      // Parse kết quả — mỗi dòng là 1 gợi ý
      const suggestions = result
        .split("\n")
        .map((s) => s.trim())
        // Lọc dòng trống và dòng có vẻ là giải thích (quá dài)
        .filter((s) => s.length > 0 && s.length <= 100)
        .slice(0, 3);

      // Đảm bảo luôn trả về đủ 3 gợi ý, fallback nếu Gemini trả thiếu
      const fallbacks = [
        "Được bạn ơi!",
        "Cho mình hỏi thêm nhé?",
        "Mình hiểu rồi 👍",
      ];
      while (suggestions.length < 3) {
        suggestions.push(fallbacks[suggestions.length]);
      }

      return { suggestions };
    } catch (error) {
      this.logger.error(
        "Lỗi khi gợi ý câu trả lời (SmartReply):",
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException(
        "Đã xảy ra lỗi khi tạo gợi ý câu trả lời.",
      );
    }
  }

  /**
   * Feature 4: Sentiment Analysis — Phân tích cảm xúc hội thoại
   * Phân tích cảm xúc tổng thể của đoạn hội thoại và trả về JSON có cấu trúc.
   */
  async analyzeSentiment(
    messages: ChatMessageSummaryInput[],
  ): Promise<SentimentResult> {
    if (!messages || messages.length === 0) {
      return {
        sentiment: "neutral",
        score: 0.5,
        detail: "Không có tin nhắn để phân tích.",
        emotions: [],
      };
    }

    try {
      const promptTemplate = PromptTemplate.fromTemplate(`
Bạn là chuyên gia phân tích cảm xúc hội thoại. Phân tích đoạn chat dưới đây và trả về JSON.

Trả về JSON với đúng cấu trúc sau, KHÔNG giải thích thêm, KHÔNG markdown, KHÔNG code block:
{{
  "sentiment": "positive" | "neutral" | "negative",
  "score": <số thực từ 0.0 đến 1.0, 0=rất tiêu cực, 0.5=trung lập, 1=rất tích cực>,
  "detail": "<mô tả ngắn gọn bằng tiếng Việt, tối đa 20 từ>",
  "emotions": ["<cảm xúc 1>", "<cảm xúc 2>"]
}}

Các cảm xúc hợp lệ cho mảng emotions:
vui vẻ, hào hứng, yêu thương, hài lòng, bình thường,
lo lắng, buồn bã, tức giận, thất vọng, căng thẳng

HỘI THOẠI:
{chatHistory}
    `);

      const recentMessages = messages.slice(-20);
      const formattedHistory = recentMessages
        .map((m) => {
          const time = m.timestamp
            ? `[${new Date(m.timestamp).toLocaleTimeString("vi-VN")}] `
            : "";
          return `${time}${m.sender}: ${m.content}`;
        })
        .join("\n");



      const chain = promptTemplate.pipe(this.stableModel).pipe(new StringOutputParser());

      const raw = await chain.invoke({ chatHistory: formattedHistory });

      return this.parseSentimentJson(raw);
    } catch (error) {
      this.logger.error(
        "Lỗi khi phân tích sentiment:",
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException(
        "Đã xảy ra lỗi khi phân tích cảm xúc hội thoại.",
      );
    }
  }

  /**
   * Parse JSON từ Gemini — xử lý các trường hợp Gemini trả về không chuẩn
   */
  private parseSentimentJson(raw: string): SentimentResult {
    try {
      // Gemini đôi khi bọc trong ```json ... ``` dù đã dặn không làm vậy
      const cleaned = raw
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/gi, "")
        .trim();

      const parsed = JSON.parse(cleaned);

      // Validate và normalize từng field — tránh LLM trả sai kiểu
      const sentiment = ["positive", "neutral", "negative"].includes(
        parsed.sentiment,
      )
        ? parsed.sentiment
        : "neutral";

      const score =
        typeof parsed.score === "number"
          ? Math.min(1, Math.max(0, parsed.score)) // clamp 0–1
          : 0.5;

      const detail =
        typeof parsed.detail === "string"
          ? parsed.detail
          : "Không xác định được cảm xúc.";

      const emotions = Array.isArray(parsed.emotions)
        ? parsed.emotions.filter((e: any) => typeof e === "string").slice(0, 3)
        : [];

      return { sentiment, score, detail, emotions };
    } catch {
      this.logger.warn(`Không parse được JSON sentiment, raw: ${raw}`);
      // Fallback an toàn thay vì throw
      return {
        sentiment: "neutral",
        score: 0.5,
        detail: "Không phân tích được cảm xúc.",
        emotions: [],
      };
    }
  }

  /**
   * Feature 5: Translate — Dịch tin nhắn sang ngôn ngữ khác
   * Dịch nội dung tin nhắn, tự động nhận diện ngôn ngữ gốc,
   * giữ nguyên emoji, tên riêng và format đặc biệt.
   */
  async translateMessage(
    text: string,
    targetLanguage: string,
  ): Promise<TranslateResult> {
    if (!text || text.trim().length === 0) {
      return {
        translatedText: "",
        detectedLanguage: "unknown",
        detectedLanguageName: "Không xác định",
        targetLanguage,
        isSameLanguage: false,
      };
    }

    try {
      const promptTemplate = PromptTemplate.fromTemplate(`
Bạn là chuyên gia dịch thuật. Dịch tin nhắn sau sang {targetLanguage}.

Quy tắc bắt buộc:
- Giữ nguyên emoji, tên riêng, số điện thoại, link URL.
- Giữ nguyên format (xuống dòng, khoảng cách).
- Dịch tự nhiên như người bản ngữ, KHÔNG dịch từng từ máy móc.
- Nếu tin nhắn đã là {targetLanguage} rồi, vẫn trả về JSON nhưng đánh dấu isSameLanguage: true.
- KHÔNG giải thích, KHÔNG markdown, KHÔNG code block.

Trả về đúng JSON sau:
{{
  "translatedText": "<bản dịch>",
  "detectedLanguage": "<mã ngôn ngữ gốc, ví dụ: vi, en, ja, ko, zh>",
  "detectedLanguageName": "<tên ngôn ngữ gốc bằng tiếng Việt, ví dụ: Tiếng Việt>",
  "isSameLanguage": <true nếu ngôn ngữ gốc = ngôn ngữ đích, ngược lại false>
}}

TIN NHẮN CẦN DỊCH:
{text}
    `);



      const chain = promptTemplate.pipe(this.stableModel).pipe(new StringOutputParser());

      const raw = await chain.invoke({
        text,
        targetLanguage,
      });

      return this.parseTranslateJson(raw, targetLanguage);
    } catch (error) {
      this.logger.error(
        "Lỗi khi dịch tin nhắn:",
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException(
        "Đã xảy ra lỗi trong quá trình dịch tin nhắn.",
      );
    }
  }

  /**
   * Parse JSON từ Gemini — xử lý các trường hợp format không chuẩn
   */
  private parseTranslateJson(
    raw: string,
    targetLanguage: string,
  ): TranslateResult {
    try {
      const cleaned = raw
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/gi, "")
        .trim();

      const parsed = JSON.parse(cleaned);

      return {
        translatedText:
          typeof parsed.translatedText === "string"
            ? parsed.translatedText
            : raw.trim(),
        detectedLanguage:
          typeof parsed.detectedLanguage === "string"
            ? parsed.detectedLanguage
            : "unknown",
        detectedLanguageName:
          typeof parsed.detectedLanguageName === "string"
            ? parsed.detectedLanguageName
            : "Không xác định",
        targetLanguage,
        isSameLanguage:
          typeof parsed.isSameLanguage === "boolean"
            ? parsed.isSameLanguage
            : false,
      };
    } catch {
      this.logger.warn(`Không parse được JSON translate, raw: ${raw}`);
      // Fallback — trả về raw text luôn thay vì throw
      return {
        translatedText: raw.trim(),
        detectedLanguage: "unknown",
        detectedLanguageName: "Không xác định",
        targetLanguage,
        isSameLanguage: false,
      };
    }
  }
}
