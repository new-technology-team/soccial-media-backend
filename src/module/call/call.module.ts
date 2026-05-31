import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CallController } from "./call.controller";
import { CallService } from "./call.service";
import { CallLog } from "./call-log.entity";
import { NotificationModule } from "../notification/notification.module";
import { Message } from "../message/message.entity";
import { ConversationModule } from "../conversation/conversation.module";

@Module({
    imports: [TypeOrmModule.forFeature([CallLog, Message], 'mongodb'), NotificationModule, ConversationModule],
    controllers: [CallController],
    providers: [CallService],
    exports: [CallService],
})
export class CallModule { }
