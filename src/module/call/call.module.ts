import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CallController } from "./call.controller";
import { CallService } from "./call.service";
import { CallLog } from "./call-log.entity";
import { NotificationModule } from "../notification/notification.module";

@Module({
    imports: [TypeOrmModule.forFeature([CallLog], 'mongodb'), NotificationModule],
    controllers: [CallController],
    providers: [CallService],
    exports: [CallService],
})
export class CallModule { }
