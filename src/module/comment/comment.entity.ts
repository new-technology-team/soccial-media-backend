import { Entity, ObjectIdColumn, ObjectId, Column } from "typeorm";

@Entity()
export class Comment {
    @ObjectIdColumn()
    _id: ObjectId;

    @Column()
    postId: string;

    @Column()
    userId: number;

    @Column()
    content: string;

    @Column({ nullable: true })
    file: string | null;

    @Column({ nullable: true })
    parentCommentId: string | null;

    @Column()
    status: string;

    @Column()
    reactions: any[];

    @Column()
    createdAt: Date;

    @Column()
    updatedAt: Date;
}
