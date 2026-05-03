export declare class MailService {
    private logger;
    private transporter;
    constructor();
    private initializeTransporter;
    sendWelcomeEmail(email: string, fullName: string): Promise<boolean>;
    sendVerificationEmail(email: string, code: string): Promise<boolean>;
    sendPasswordResetEmail(email: string, resetCode: string): Promise<boolean>;
    sendNotificationEmail(email: string, subject: string, message: string, actionUrl?: string): Promise<boolean>;
    testConnection(): Promise<boolean>;
}
//# sourceMappingURL=mail.service.d.ts.map