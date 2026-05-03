import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as path from "path";
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from "@langchain/google-genai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { Document } from "@langchain/core/documents";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import {
  GEMINI_MODEL,
  MAX_HISTORY_TURNS,
  ZCHAT_SYSTEM_PROMPT,
} from "./ai.constants";
import { AiChatDto, ChatHistoryEntryDto } from "./dto/ai-chat.dto";
import { AiMessage as AiMessageEntity } from "./ai-message.entity";

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private chatModel: ChatGoogleGenerativeAI;
  private embeddings: GoogleGenerativeAIEmbeddings;
  private vectorStore: Chroma | null = null;
  private qnaChain: RunnableSequence | null = null;
  private ragReady = false;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(AiMessageEntity, 'mongodb')
    private readonly aiMessageRepo: Repository<AiMessageEntity>,
  ) {
    const apiKey = this.config.get<string>("GEMINI_API_KEY") || "";
    if (!apiKey) {
      this.logger.warn(
        "GEMINI_API_KEY chưa được cấu hình – AI sẽ không hoạt động.",
      );
    }

    this.chatModel = new ChatGoogleGenerativeAI({
      apiKey: apiKey,
      model: GEMINI_MODEL,
    });

    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: apiKey,
      model: "gemini-embedding-2",
    });
  }

  async onModuleInit() {
    const chromaUrl =
      this.config.get<string>("CHROMA_URL") || "http://localhost:8000";
    this.logger.log(`Khởi tạo Chroma Vector Store tại ${chromaUrl}...`);

    try {
      this.vectorStore = new Chroma(this.embeddings, {
        collectionName: "app_docs",
        url: chromaUrl,
      });

      // Kiểm tra kết nối ChromaDB bằng cách thực hiện một query nhỏ
      await this.vectorStore.similaritySearch("test", 1);

      // Seed kiến thức nếu DB trống
      await this.seedKnowledgeBase();

      this.setupRagChain();
      this.ragReady = true;
      this.logger.log("✅ Chroma Vector Store & RAG Chain khởi tạo thành công.");
    } catch (e) {
      this.logger.warn(
        `⚠️  ChromaDB chưa sẵn sàng (${chromaUrl}). AI sẽ dùng chế độ Direct Chat (không RAG). Lỗi: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      this.vectorStore = null;
      this.qnaChain = null;
      this.ragReady = false;
    }
  }

  /**
   * Thiết lập RAG Chain: Nhận câu hỏi → Tìm kiếm Context (Vector Store) → Đưa Context & Câu hỏi vào Prompt → Trả lời
   */
  private setupRagChain() {
    if (!this.vectorStore) return;

    const retriever = this.vectorStore.asRetriever(3);

    const promptTemplate = PromptTemplate.fromTemplate(`
      {system_prompt}
      
      Bạn là trợ lý AI thông minh cho ứng dụng Zalo Clone của chúng tôi. Hãy trả lời câu hỏi dựa trên các tài liệu nội bộ (context) được cung cấp dưới đây. Nếu thông tin không có trong tài liệu, hãy sử dụng kiến thức kết hợp nhưng vẫn giữ nguyên tinh thần hỗ trợ người dùng ứng dụng.
      
      Dữ liệu nội bộ (Context):
      {context}
      
      Lịch sử trò chuyện:
      {history}
      
      Câu hỏi của người dùng: {question}
      
      Câu trả lời:
    `);

    this.qnaChain = RunnableSequence.from([
      {
        context: async (input: { question: string; history: string }) => {
          try {
            const docs = await retriever.invoke(input.question);
            return docs.map((d) => d.pageContent).join("\n\n");
          } catch {
            // Nếu ChromaDB lỗi trong lúc query, trả về context rỗng
            return "";
          }
        },
        question: (input: { question: string; history: string }) =>
          input.question,
        history: (input: { question: string; history: string }) =>
          input.history,
        system_prompt: () => ZCHAT_SYSTEM_PROMPT,
      },
      promptTemplate,
      this.chatModel,
      new StringOutputParser(),
    ]);
  }

  /**
   * Tự động khởi tạo dữ liệu vào ChromaDB nếu database trống.
   * Giúp tiết kiệm chi phí không phải gọi embedding API nhiều lần.
   */
  private async seedKnowledgeBase() {
    if (!this.vectorStore) return;

    try {
      // Đếm số lượng document hiện có
      let count = 0;
      const collection = (this.vectorStore as any).collection;
      if (collection && typeof collection.count === 'function') {
        count = await collection.count();
      } else {
        // Fallback nếu không gọi được count()
        const testResult = await this.vectorStore.similaritySearch("", 1);
        count = testResult.length > 0 ? 1 : 0; // Giả lập có dữ liệu
      }

      if (count === 0) {
        this.logger.log("ChromaDB đang trống. Tiến hành seed dữ liệu từ knowledge.json...");
        const filePath = path.join(process.cwd(), 'src', 'module', 'ai', 'data', 'knowledge.json');

        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const data = JSON.parse(fileContent);

          const texts = data.map((item: any) => `${item.category} - ${item.feature}\n${item.description}`);
          const metadatas = data.map((item: any) => ({ category: item.category, feature: item.feature }));

          await this.ingestKnowledgeBase(texts, metadatas);
          this.logger.log("✅ Seed dữ liệu thành công!");
        } else {
          this.logger.warn(`Không tìm thấy file knowledge.json tại ${filePath}`);
        }
      } else {
        this.logger.log(`ChromaDB đã có sẵn dữ liệu (${count} docs). Bỏ qua seed để tiết kiệm chi phí.`);
      }
    } catch (error) {
      this.logger.error("Lỗi khi seed dữ liệu vào ChromaDB:", error);
    }
  }

  /**
   * Lấy lịch sử chat của user
   */
  async getHistory(userId: number) {
    const messages = await this.aiMessageRepo.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
    return messages.map(msg => ({
      role: msg.role,
      text: msg.text,
    }));
  }

  /**
   * Feature 1: Gửi tin nhắn đến Gemini
   * - Lưu lịch sử chat vào DB
   * - Nếu RAG (ChromaDB) sẵn sàng: dùng RAG pipeline để truy vấn tài liệu nội bộ
   * - Nếu ChromaDB chưa sẵn sàng: fallback về Direct Chat với Gemini
   */
  async chat(dto: AiChatDto, userId: number): Promise<{ reply: string }> {
    const apiKey = this.config.get<string>("GEMINI_API_KEY") || "";
    if (!apiKey) {
      throw new InternalServerErrorException(
        "GEMINI_API_KEY chưa được cấu hình trên server.",
      );
    }

    // 1. Lưu tin nhắn của user vào DB
    await this.aiMessageRepo.save({
      userId,
      role: 'user',
      text: dto.message,
    });

    // 2. Lấy lịch sử từ DB (thay vì frontend truyền lên)
    const historyDocs = await this.aiMessageRepo.find({
      where: { userId },
      order: { createdAt: 'ASC' },
      take: MAX_HISTORY_TURNS * 2,
    });
    
    // Convert to ChatHistoryEntryDto format
    const history: ChatHistoryEntryDto[] = historyDocs.map(doc => ({
      role: doc.role,
      text: doc.text
    }));

    let reply = "";

    // --- Chế độ RAG (nếu ChromaDB sẵn sàng) ---
    if (this.ragReady && this.qnaChain) {
      try {
        const formattedHistory = this.formatHistory(history);
        reply = await this.qnaChain.invoke({
          question: dto.message,
          history: formattedHistory,
        });
      } catch (error) {
        this.logger.error(
          "RAG Q&A lỗi, thử fallback sang Direct Chat:",
          error instanceof Error ? error.message : error,
        );
        // Fallback sang direct chat nếu RAG lỗi giữa chừng
      }
    }

    // --- Chế độ Direct Chat (fallback khi ChromaDB không có hoặc RAG lỗi) ---
    if (!reply) {
      try {
        const messages = [
          new SystemMessage(ZCHAT_SYSTEM_PROMPT),
          ...this.buildHistoryMessages(history),
          new HumanMessage(dto.message),
        ];

        const chain = this.chatModel.pipe(new StringOutputParser());
        reply = await chain.invoke(messages);
      } catch (error) {
        this.logger.error(
          "Direct Chat lỗi:",
          error instanceof Error ? error.stack : error,
        );
        throw new InternalServerErrorException(
          "Trợ lý AI tạm thời gặp sự cố. Vui lòng thử lại sau.",
        );
      }
    }

    // 3. Lưu câu trả lời của AI vào DB
    await this.aiMessageRepo.save({
      userId,
      role: 'model',
      text: reply,
    });

    return { reply };
  }

  /**
   * API để upload/ingest tài liệu nội bộ vào ChromaDB (PDF/String)
   */
  async ingestKnowledgeBase(
    texts: string[],
    metadatas?: Record<string, any>[],
  ): Promise<boolean> {
    if (!this.vectorStore) {
      this.logger.warn("ChromaDB chưa sẵn sàng, không thể ingest tài liệu.");
      return false;
    }
    try {
      const docs = texts.map(
        (text, i) =>
          new Document({
            pageContent: text,
            metadata: metadatas ? metadatas[i] : {},
          }),
      );
      await this.vectorStore.addDocuments(docs);
      this.logger.log(`Đã thêm ${docs.length} tài liệu vào ChromaDB`);
      return true;
    } catch (error) {
      this.logger.error("Lỗi khi nạp dữ liệu vào ChromaDB", error);
      return false;
    }
  }

  /**
   * Chuyển đổi lịch sử hội thoại thành chuỗi text cho RAG prompt
   */
  private formatHistory(history: ChatHistoryEntryDto[]): string {
    const sliced = history.slice(-MAX_HISTORY_TURNS * 2);
    return sliced
      .map((e) => `${e.role === "user" ? "User" : "AI"}: ${e.text}`)
      .join("\n");
  }

  /**
   * Chuyển đổi lịch sử hội thoại thành LangChain messages (cho Direct Chat)
   */
  private buildHistoryMessages(history: ChatHistoryEntryDto[]) {
    const sliced = history.slice(-MAX_HISTORY_TURNS * 2);
    return sliced.map((entry) => {
      return entry.role === "user"
        ? new HumanMessage(entry.text)
        : new AIMessage(entry.text);
    });
  }
}
