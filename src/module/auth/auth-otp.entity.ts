export class AuthOtp {
    id!: number;
    identifier!: string;
    purpose!: string;
    code!: string;
    expiresAt!: Date;
    usedAt!: Date | null;
    createdAt!: Date;
}
