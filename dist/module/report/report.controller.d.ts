import { ReportService } from "./report.service";
export declare class ReportController {
    private readonly reportService;
    constructor(reportService: ReportService);
    submitReport(user: any, body: any): Promise<{
        message: string;
        report: import("./report.entity").Report;
    }>;
    getModerationReports(user: any, status?: string, limit?: string): Promise<{
        reports: import("./report.entity").Report[];
    }>;
    reviewModerationReport(user: any, id: string, body: any): Promise<{
        message: string;
        report: import("./report.entity").Report;
    }>;
    moderateFeedPost(user: any, postId: string, body: any): Promise<{
        message: string;
        post: import("../post/post.entity").Post;
    }>;
    getAdminStats(user: any): Promise<{
        stats: {
            users: number;
            reports: number;
            posts: number;
        };
    }>;
    getModerationUsers(user: any, q?: string, limit?: string): Promise<{
        users: import("../user/user.entity").User[];
    }>;
    updateModerationUserById(user: any, userId: string, body: any): Promise<{
        message: string;
        user: import("../user/user.entity").User;
    }>;
}
