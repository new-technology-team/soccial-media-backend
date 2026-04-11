import { Entity, ObjectIdColumn, ObjectId, Column } from "typeorm";
import { Interacts } from "../../common/embedded/interacts.embed";

@Entity()
export class Post {
    @ObjectIdColumn()
    _id: ObjectId;

    @Column()
    title: string;

    @Column()
    content: string;

    @Column()
    createdAt: Date;

    @Column(() => Interacts)
    interacts: Interacts[];

    constructor(
        _id: ObjectId,
        title: string,
        content: string,
        createdAt: Date,
        interacts: Interacts[]
    ) {
        this._id = _id;
        this.title = title;
        this.content = content;
        this.createdAt = createdAt;
        this.interacts = interacts;
    }
}