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
        report: Report;
    }>;
    listReports(actor: any, status?: string, limit?: number): Promise<{
        reports: Report[];
    }>;
    reviewReport(actor: any, reportId: number, body: any): Promise<{
        message: string;
        report: Report;
    }>;
    moderatePost(actor: any, postId: string, body: any): Promise<{
        message: string;
        post: Post;
    }>;
    getAdminStats(actor: any): Promise<{
        stats: {
            users: number;
            reports: number;
            posts: number;
        };
    }>;
    listUsers(actor: any, keyword?: string, limit?: number): Promise<{
        users: User[];
    }>;
    updateUser(actor: any, userId: number, body: any): Promise<{
        message: string;
        user: User;
    }>;
}
