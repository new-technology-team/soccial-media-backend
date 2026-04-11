import { Entity, ObjectIdColumn, ObjectId, Column } from "typeorm";
import { Owner } from "../../common/embedded/owner.embed";

@Entity()
export class Comment {
    @ObjectIdColumn()
    _id: ObjectId;

    @Column()
    postId: string;

    @Column()
    content: string;

    @Column({ nullable: true })
    file: string;

    @Column(() => Owner)
    owner: Owner;

    constructor(
        _id: ObjectId,
        postId: string,
        content: string,
        file: string,
        owner: Owner
    ) {
        this._id = _id;
        this.postId = postId;
        this.content = content;
        this.file = file;
        this.owner = owner;
    }
}