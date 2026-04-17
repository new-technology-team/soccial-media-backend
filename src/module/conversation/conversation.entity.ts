import { Entity, ObjectIdColumn, ObjectId, Column } from "typeorm";

@Entity()
export class Conversation {
    @ObjectIdColumn()
    _id: ObjectId;

    @Column()
    type: string;

    @Column()
    name: string;

    @Column({ nullable: true })
    avatarUrl: string | null;

    @Column()
    createdBy: number;

    @Column()
    createdAt: Date;

    @Column()
    updatedAt: Date;

    @Column()
    members: any[];

    @Column({ nullable: true })
    lastMessage: any;

    @Column({ nullable: true })
    pinnedMessageIds: string[];
}