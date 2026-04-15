import { Module } from "@nestjs/common";
import { ConversationController } from "./conversation.controller";
import { ConversationService } from "./conversation.service";
import { Conversation } from "./conversation.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserModule } from "../user/user.module";


@Module({
    imports: [TypeOrmModule.forFeature([Conversation], 'mongodb'), UserModule],
    controllers: [ConversationController],
    providers: [ConversationService],
    exports: [ConversationService, TypeOrmModule],
})
export class ConversationModule {}