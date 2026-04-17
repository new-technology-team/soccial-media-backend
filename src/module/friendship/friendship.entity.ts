import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { FriendshipStatus } from "../../common/enum/friendship-status.enum";
@Entity()
export class Friendship {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    userId1: number;

    @Column({ type: 'int' })
    userId2: number;

    @Column({
        type: 'enum',
        enum: FriendshipStatus,
        default: FriendshipStatus.PENDING,
    })
    status: FriendshipStatus;

    @Column({ type: 'varchar', length: 64 })
    conversationId: string;

    @Column({ type: 'datetime' })
    createdAt: Date;
}