export class Owner {
    userId: number;
    displayName: string;
    avatarUrl: string;
    constructor(userId: number, displayName: string, avatarUrl: string) {
        this.userId = userId;
        this.displayName = displayName;
        this.avatarUrl = avatarUrl;
    }
}