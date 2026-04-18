import { Repository } from "typeorm";
import { Report } from "./report.entity";
import { User } from "../user/user.entity";
import { Post } from "../post/post.entity";
export declare class ReportService {
    private readonly reportRepository;
    private readonly userRepository;
    private readonly postRepository;
    constructor(reportRepository: Repository<Report>, userRepository: Repository<User>, postRepository: Repository<Post>);
    submitReport(actorId: number, body: any): Promise<{
        message: string;
        report: any;
    }>;
    listReports(actor: any, status?: string, limit?: number): Promise<{
        reports: any;
    }>;
    reviewReport(actor: any, reportId: number, body: any): Promise<{
        message: string;
        report: any;
    }>;
    moderatePost(actor: any, postId: string, body: any): Promise<{
        message: string;
        post: any;
    }>;
    getAdminStats(actor: any): Promise<{
        stats: {
            users: any;
            reports: any;
            posts: any;
        };
    }>;
    listUsers(actor: any, keyword?: string, limit?: number): Promise<{
        users: any;
    }>;
    updateUser(actor: any, userId: number, body: any): Promise<{
        message: string;
        user: any;
    }>;
}
//# sourceMappingURL=report.service.d.ts.map