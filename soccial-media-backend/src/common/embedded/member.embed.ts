import { ConversationRole } from '../enum/conversation-role.enum';

export class Member {
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string;
  roleInConversation: ConversationRole;

  constructor(
    userId: number,
    username: string,
    displayName: string,
    avatarUrl: string,
    roleInConversation: ConversationRole,
  ) {
    this.userId = userId;
    this.username = username;
    this.displayName = displayName;
    this.avatarUrl = avatarUrl;
    this.roleInConversation = roleInConversation;
  }
}
