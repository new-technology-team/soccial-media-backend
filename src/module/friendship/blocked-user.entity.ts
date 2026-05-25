import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class BlockedUser {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "int" })
    blockerId: number;

    @Column({ type: "int" })
    blockedUserId: number;

    @Column({ type: "datetime" })
    createdAt: Date;
}
