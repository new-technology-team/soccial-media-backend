/** Một lượt trong lịch sử hội thoại */
export declare class ChatHistoryEntryDto {
    role: 'user' | 'model';
    text: string;
}
/** Body gửi lên khi chat với AI */
export declare class AiChatDto {
    message: string;
    /** Lịch sử hội thoại từ phía client (tuỳ chọn – client có thể tự quản lý) */
    history?: ChatHistoryEntryDto[];
}
//# sourceMappingURL=ai-chat.dto.d.ts.map