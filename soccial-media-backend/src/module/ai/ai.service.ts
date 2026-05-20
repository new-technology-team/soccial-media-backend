import {
  Inject,              // ← thêm Inject vào đây
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { GEMINI_CHAT_MODEL, GEMINI_EMBEDDINGS } from './ai.provider';
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
import { GEMINI_MODEL, MAX_HISTORY_TURNS, ZCHAT_SYSTEM_PROMPT } from "./ai.constants";
import { AiChatDto, ChatHistoryEntryDto } from "./dto/ai-chat.dto";
import { AiMessage as AiMessageEntity } from "./ai-message.entity";

interface KnowledgeEntry {
  id?: string;
  category: string;
  feature: string;
  description: string;
  howTo?: string;
  faq?: string[];
  keywords?: string[];
}
@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private vectorStore: Chroma | null = null;
  private qnaChain: RunnableSequence | null = null;
  private ragReady = false;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(AiMessageEntity, "mongodb")
    private readonly aiMessageRepo: Repository<AiMessageEntity>,

    // ✅ Inject từ provider thay vì tự khởi tạo
    @Inject(GEMINI_CHAT_MODEL)
    private readonly chatModel: ChatGoogleGenerativeAI,

    @Inject(GEMINI_EMBEDDINGS)
    private readonly embeddings: GoogleGenerativeAIEmbeddings,
  ) {


  }

  async onModuleInit() {
    if (!this.config.get<string>("GEMINI_API_KEY")) {
      this.logger.warn(
        "GEMINI_API_KEY chưa được cấu hình. Bỏ qua khởi tạo Chroma/RAG.",
      );
      this.vectorStore = null;
      this.qnaChain = null;
      this.ragReady = false;
      return;
    }

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
      this.logger.log(
        "✅ Chroma Vector Store & RAG Chain khởi tạo thành công.",
      );
    } catch (e) {
      this.logger.warn(
        `⚠️  ChromaDB chưa sẵn sàng (${chromaUrl}). AI sẽ dùng chế độ Direct Chat (không RAG). Lỗi: ${e instanceof Error ? e.message : String(e)
        }`,
      );
      this.vectorStore = null;
      this.qnaChain = null;
      this.ragReady = false;
    }
  }

  /**
   * Nhận diện category từ câu hỏi của user dựa trên keyword matching.
   * Trả về tên category khớp với metadata trong ChromaDB, hoặc null nếu không xác định được.
   */
  private detectCategory(question: string): string | null {
    const q = question.toLowerCase();

    const categoryMap: Record<string, string[]> = {
      "Nhắn tin": [
        "tin nhắn",
        "nhắn tin",
        "chat",
        "gửi",
        "thu hồi",
        "ghim",
        "chuyển tiếp",
        "sticker",
        "emoji",
        "hình ảnh",
        "video",
        "ảnh",
        "đính kèm",
        "file",
        "gọi thoại",
        "gọi video",
        "voice call",
        "video call",
        "gọi điện",
        "nhóm",
        "group",
        "tạo nhóm",
        "thành viên",
        "rời nhóm",
        "forward",
        "unsend",
        "recall",
        "pin",
        "media",
      ],
      "Bạn bè": [
        "bạn bè",
        "kết bạn",
        "lời mời",
        "thêm bạn",
        "xóa bạn",
        "chặn",
        "block",
        "danh sách bạn",
        "friend",
        "add friend",
        "chấp nhận",
        "từ chối",
        "friend request",
      ],
      "Mạng xã hội": [
        "bài đăng",
        "đăng bài",
        "feed",
        "bảng tin",
        "bình luận",
        "comment",
        "reaction",
        "like",
        "tim",
        "thả tim",
        "quyền riêng tư",
        "privacy",
        "public",
        "private",
        "post",
        "trạng thái",
        "status",
      ],
      "Tài khoản": [
        "đăng ký",
        "đăng nhập",
        "mật khẩu",
        "tài khoản",
        "hồ sơ",
        "avatar",
        "ảnh đại diện",
        "otp",
        "xác thực",
        "profile",
        "login",
        "register",
        "sign up",
        "sign in",
        "đổi mật khẩu",
        "tên hiển thị",
        "cập nhật thông tin",
      ],
      "Thông báo": [
        "thông báo",
        "notification",
        "push",
        "chuông",
        "báo",
        "nhận thông báo",
        "tắt thông báo",
      ],
      "Trí tuệ nhân tạo (AI)": [
        "ai",
        "trí tuệ nhân tạo",
        "tóm tắt",
        "phân tích",
        "cảm xúc",
        "sentiment",
        "dịch",
        "translate",
        "phiên dịch",
        "gợi ý",
        "smart reply",
        "trả lời nhanh",
        "tự động"
      ]
    };

    // Đếm số keyword khớp cho từng category → chọn category có nhiều nhất
    let bestCategory: string | null = null;
    let bestScore = 0;

    for (const [category, keywords] of Object.entries(categoryMap)) {
      const score = keywords.filter((kw) => q.includes(kw)).length;
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }

    // Chỉ filter khi có ít nhất 1 keyword khớp rõ ràng
    return bestScore > 0 ? bestCategory : null;
  }

  /**
   * Thiết lập RAG Chain: Nhận câu hỏi → Tìm kiếm Context (Vector Store) → Đưa Context & Câu hỏi vào Prompt → Trả lời
   */
  private setupRagChain() {
    if (!this.vectorStore) return;

    const retriever = this.vectorStore.asRetriever(3);

    const promptTemplate = PromptTemplate.fromTemplate(`
      {system_prompt}
      
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
            const docs = await this.retrieveWithFilter(input.question);
            return docs.map((d) => d.pageContent).join("\n\n");
          } catch {
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
   * Retrieve documents từ ChromaDB với metadata filter nếu detect được category.
   * Nếu filter trả về ít hơn 2 kết quả → fallback về tìm không filter để tránh bỏ sót.
   */
  private async retrieveWithFilter(question: string) {
    const category = this.detectCategory(question);

    // Có detect được category → thử tìm có filter trước
    if (category) {
      this.logger.debug(
        `Detected category: "${category}" cho câu hỏi: "${question}"`,
      );

      try {
        const filteredDocs = await this.vectorStore!.similaritySearch(
          question,
          4, // Lấy top-4 trong category đó
          { category }, // Metadata filter — khớp với field category trong metadatas khi seed
        );

        // Đủ kết quả → dùng luôn
        if (filteredDocs.length >= 2) {
          this.logger.debug(
            `Filter trả về ${filteredDocs.length} docs từ category "${category}"`,
          );
          return filteredDocs;
        }

        // Ít hơn 2 kết quả → có thể category detect sai hoặc knowledge thiếu
        this.logger.debug(
          `Filter chỉ trả về ${filteredDocs.length} docs, fallback về tìm không filter`,
        );
      } catch (err) {
        this.logger.warn(
          `similaritySearch có filter lỗi: ${err}, fallback về không filter`,
        );
      }
    } else {
      this.logger.debug(`Không detect được category, tìm không filter`);
    }

    // Fallback — tìm toàn bộ collection không filter
    return this.vectorStore!.similaritySearch(question, 3);
  }

  /**
   * Tự động khởi tạo dữ liệu vào ChromaDB nếu database trống.
   * Giúp tiết kiệm chi phí không phải gọi embedding API nhiều lần.
   */
  private async seedKnowledgeBase() {
    if (!this.vectorStore) return;

    try {
      // ✅ Lấy count trực tiếp từ ChromaDB client — không cần embed gì cả
      const count = await this.getCollectionCount();
      if (count === 0) {
        this.logger.log(
          "ChromaDB đang trống. Tiến hành seed dữ liệu từ knowledge.json...",
        );
        const filePath = path.join(
          process.cwd(),
          "src",
          "module",
          "ai",
          "data",
          "knowledge.json",
        );

        if (!fs.existsSync(filePath)) {
          this.logger.warn(
            `Không tìm thấy file knowledge.json tại ${filePath}`,
          );
          return;
        }

        const data: KnowledgeEntry[] = JSON.parse(
          fs.readFileSync(filePath, "utf8"),
        );

        // ✅ Embed đủ 5 field thay vì chỉ 3 field như trước
        const texts = data.map((item) => {
          const parts = [
            `${item.category} - ${item.feature}`,
            item.description,
            item.howTo ? `Cách thực hiện: ${item.howTo}` : "",
            item.faq?.length
              ? `Câu hỏi thường gặp: ${item.faq.join(". ")}`
              : "",
            item.keywords?.length ? `Từ khóa: ${item.keywords.join(", ")}` : "",
          ];
          return parts.filter(Boolean).join("\n");
        });

        const metadatas = data.map((item) => ({
          id: item.id ?? "",
          category: item.category ?? "",
          feature: item.feature ?? "",
        }));

        await this.ingestKnowledgeBase(texts, metadatas);
        this.logger.log(`✅ Seed thành công ${data.length} entries!`);
      } else {
        this.logger.log(`ChromaDB đã có ${count} docs. Bỏ qua seed.`);
      }
    } catch (error) {
      this.logger.error("Lỗi khi seed ChromaDB:", error);
    }
  }

  private async getCollectionCount(): Promise<number> {
    const store = this.vectorStore as any;

    if (store.collection?.count) {
      try {
        return await store.collection.count();
      } catch {
        this.logger.debug("getCollectionCount: cách 1 thất bại, thử cách 2");
      }
    }

    if (store._client?.getCollection) {
      try {
        const col = await store._client.getCollection({
          name: store.collectionName ?? "app_docs",
        });
        return await col.count();
      } catch {
        this.logger.debug("getCollectionCount: cách 2 thất bại, thử cách 3");
      }
    }

    if (store.collection?.peek) {
      try {
        const peeked = await store.collection.peek({ limit: 1 });
        return peeked?.ids?.length ?? 0;
      } catch {
        this.logger.debug("getCollectionCount: cách 3 thất bại, mặc định seed");
      }
    }

    this.logger.warn(
      "Không lấy được collection count, tiến hành seed để an toàn",
    );
    return 0;
  }

  /**
   * Lấy lịch sử chat của user
   */
  async getHistory(userId: number) {
    const messages = await this.aiMessageRepo.find({
      where: { userId },
      order: { createdAt: "ASC" },
    });
    return messages.map((msg) => ({
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

    // 1. Lấy lịch sử trước- Lúc này db chưa có tin nhắn hiện tại
    const historyDocs = await this.aiMessageRepo.find({
      where: { userId },
      order: { createdAt: "ASC" },
      take: MAX_HISTORY_TURNS * 2,
    });

    // Convert to ChatHistoryEntryDto format
    const history: ChatHistoryEntryDto[] = historyDocs.map((doc) => ({
      role: doc.role,
      text: doc.text,
    }));

    // 2. Lưu tin nhắn của user vào DB sau khi đã lấy History (để tránh lấy luôn tin nhắn hiện tại vào history)
    await this.aiMessageRepo.save({
      userId,
      role: "user",
      text: dto.message,
    });

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
      role: "model",
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
