import { Module } from "@nestjs/common";
import { ConversationController } from "./conversation.controller";
import { ConversationService } from "./conversation.service";
import { Conversation } from "./conversation.entity";
import { TypeOrmModule } from "@nestjs/typeorm";


@Module({
    imports: [TypeOrmModule.forFeature([Conversation])],
    controllers: [ConversationController],
    providers: [ConversationService]
})
export class ConversationModule {}