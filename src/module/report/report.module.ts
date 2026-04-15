import { Module } from "@nestjs/common";
import { ReportController } from "./report.controller";
import { ReportService } from "./report.service";
import { Report } from "./report.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../user/user.entity";
import { Post } from "../post/post.entity";


@Module({
    imports: [TypeOrmModule.forFeature([Report, User], 'mariadb'), TypeOrmModule.forFeature([Post], 'mongodb')],
    controllers: [ReportController],
    providers: [ReportService],
    exports: [ReportService],
})
export class ReportModule { }