import { Module } from "@nestjs/common";
import { ReportController } from "./report.controller";
import { AdminModeratorController } from "./admin-moderator.controller";
import { ReportService } from "./report.service";
import { Report } from "./report.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../user/user.entity";
import { Post } from "../post/post.entity";
import { Comment } from "../comment/comment.entity";
import { AuditLog } from "../audit-log/audit-log.entity";
import { Notification } from "../notification/notification.entity";
import { SystemSettingModule } from "../system-setting/system-setting.module";


@Module({
    imports: [TypeOrmModule.forFeature([Report, User, AuditLog], 'mariadb'), TypeOrmModule.forFeature([Post, Comment, Notification], 'mongodb'), SystemSettingModule],
    controllers: [ReportController, AdminModeratorController],
    providers: [ReportService],
    exports: [ReportService],
})
export class ReportModule { }
