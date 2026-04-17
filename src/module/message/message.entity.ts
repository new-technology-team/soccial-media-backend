import { Entity, ObjectIdColumn, ObjectId, Column } from "typeorm";

@Entity()
export class Message {
    @ObjectIdColumn()
    _id: ObjectId;

    @Column()
    conversationId: string;

    @Column()
    senderId: number;

    @Column()
    type: string;

    @Column({ nullable: true })
    text: string | null;

    @Column({ nullable: true })
    mediaUrl: string | null;

    @Column({ nullable: true })
    fileName: string | null;

    @Column({ nullable: true })
    mimeType: string | null;

    @Column({ nullable: true })
    fileSize: number | null;

    @Column({ nullable: true })
    meta: any;

    @Column({ nullable: true })
    reactions: any[];

    @Column()
    createdAt: Date;

    @Column()
    updatedAt: Date;

    @Column()
    isRecalled: boolean;

    @Column({ nullable: true })
    deletedForUserIds: number[];
}