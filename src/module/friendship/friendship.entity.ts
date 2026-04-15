import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { FriendshipStatus } from "../../common/enum/friendship-status.enum";
@Entity()
export class Friendship {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId1: number;

    @Column()
    userId2: number;

    @Column()
    status: FriendshipStatus;

    @Column()
    conversationId: string;

    @Column()
    createdAt: Date;
}