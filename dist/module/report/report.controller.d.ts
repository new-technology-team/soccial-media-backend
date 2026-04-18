import { ReportService } from "./report.service";
export declare class ReportController {
    private readonly reportService;
    constructor(reportService: ReportService);
    submitReport(user: any, body: any): Promise<{
        message: string;
        report: any;
    }>;
    getModerationReports(user: any, status?: string, limit?: string): Promise<{
        reports: any;
    }>;
    reviewModerationReport(user: any, id: string, body: any): Promise<{
        message: string;
        report: any;
    }>;
    moderateFeedPost(user: any, postId: string, body: any): Promise<{
        message: string;
        post: any;
    }>;
    getAdminStats(user: any): Promise<{
        stats: {
            users: any;
            reports: any;
            posts: any;
        };
    }>;
    getModerationUsers(user: any, q?: string, limit?: string): Promise<{
        users: any;
    }>;
    updateModerationUserById(user: any, userId: string, body: any): Promise<{
        message: string;
        user: any;
    }>;
}
//# sourceMappingURL=report.controller.d.ts.map