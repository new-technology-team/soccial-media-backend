import { ConversationRole } from '../enum/conversation-role.enum';

export class Member {
  userId: number;
  displayName: string;
  avatarUrl: string;
  roleInConversation: ConversationRole;

  constructor(
    userId: number,
    displayName: string,
    avatarUrl: string,
    roleInConversation: ConversationRole,
  ) {
    this.userId = userId;
    this.displayName = displayName;
    this.avatarUrl = avatarUrl;
    this.roleInConversation = roleInConversation;
  }
}
