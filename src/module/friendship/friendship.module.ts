import { Module } from "@nestjs/common";
import { FriendshipService } from "./friendship.service";
import { FriendshipController } from "./friendship.controller";
import { Friendship } from "./friendship.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserModule } from "../user/user.module";
import { NotificationModule } from "../notification/notification.module";

@Module({
    imports: [TypeOrmModule.forFeature([Friendship], 'mariadb'), UserModule, NotificationModule],
    controllers: [FriendshipController],
    providers: [FriendshipService],
    exports: [FriendshipService, TypeOrmModule],
})
export class FriendshipModule { }