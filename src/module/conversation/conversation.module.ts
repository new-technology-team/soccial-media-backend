import { Module } from "@nestjs/common";
import { ConversationController } from "./conversation.controller";
import { ConversationService } from "./conversation.service";
import { Conversation } from "./conversation.entity";
import { Message } from "../message/message.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserModule } from "../user/user.module";
import { FriendshipModule } from "../friendship/friendship.module";


@Module({
    imports: [TypeOrmModule.forFeature([Conversation, Message], 'mongodb'), UserModule, FriendshipModule],
    controllers: [ConversationController],
    providers: [ConversationService],
    exports: [ConversationService, TypeOrmModule],
})
export class ConversationModule {}