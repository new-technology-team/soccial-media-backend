import { Entity, ObjectIdColumn, ObjectId, Column } from "typeorm";
import { Interacts } from "../../common/embedded/interacts.embed";
import { Owner } from "../../common/embedded/owner.embed";

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

    @Column()
    interacts: Interacts[];

    @Column()
    owner: Owner;

    constructor(
        _id: ObjectId,
        title: string,
        content: string,
        createdAt: Date,
        interacts: Interacts[],
        owner: Owner
    ) {
        this._id = _id;
        this.title = title;
        this.content = content;
        this.createdAt = createdAt;
        this.interacts = interacts;
        this.owner = owner;
    }
}