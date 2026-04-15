import { Module } from "@nestjs/common";
import { MessageController } from "./message.controller";
import { MessageService } from "./message.service";
import { Message } from "./message.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConversationModule } from "../conversation/conversation.module";
import { UserModule } from "../user/user.module";
import { NotificationModule } from "../notification/notification.module";

@Module({
    imports: [TypeOrmModule.forFeature([Message], 'mongodb'), ConversationModule, UserModule, NotificationModule],
    controllers: [MessageController],
    providers: [MessageService],
    exports: [MessageService, TypeOrmModule],
})
export class MessageModule {}