export class Owner {
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string;
  constructor(userId: number, username: string, displayName: string, avatarUrl: string) {
    this.userId = userId;
    this.username = username;
    this.displayName = displayName;
    this.avatarUrl = avatarUrl;
  }
}
