import { Entity, ObjectIdColumn, ObjectId, Column } from "typeorm";

@Entity()
export class Post {
    @ObjectIdColumn()
    _id: ObjectId;

    @Column()
    content: string;

    @Column({ nullable: true })
    mediaUrl: string | null;

    @Column()
    visibility: string;

    @Column()
    status: string;

    @Column()
    authorId: number;

    @Column()
    createdAt: Date;

    @Column()
    updatedAt: Date;

    @Column()
    reactions: any[];

    @Column()
    commentCount: number;
}