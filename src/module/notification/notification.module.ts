import { Module } from "@nestjs/common";
import { NotificationController } from "./notification.controller";
import { NotificationService } from "./notification.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Notification } from "./notification.entity";
import { UserModule } from "../user/user.module";

@Module({
    imports: [TypeOrmModule.forFeature([Notification], 'mongodb'), UserModule],
    controllers: [NotificationController],
    providers: [NotificationService],
    exports: [NotificationService, TypeOrmModule],
})
export class NotificationModule { }