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

    constructor(
        id: number,
        userId1: number,
        userId2: number,
        status: FriendshipStatus,
        conversationId: string,
        createdAt: Date
    ) {
        this.id = id;
        this.userId1 = userId1;
        this.userId2 = userId2;
        this.status = status;
        this.conversationId = conversationId;
        this.createdAt = createdAt;
    }
}