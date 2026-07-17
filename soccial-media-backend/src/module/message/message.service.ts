import { Injectable } from '@nestjs/common';

/**
 * MessageService - Note: Message operations are currently handled
 * by ConversationService for consistency. This service is available
 * for future message-specific business logic.
 */
@Injectable()
export class MessageService {
  // Message CRUD operations delegated to ConversationService
  // to maintain atomicity of conversation+message state changes.
}
