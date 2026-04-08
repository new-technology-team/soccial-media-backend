
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    userId!: number;

    @Column({ unique: true })
    username!: string;

    @Column()
    displayName!: string;

    @Column({ nullable: true })
    sex?: number;

    @Column({ unique: true })
    email!: string;

    @Column({ nullable: true })
    phone?: string;

    @Column()
    password!: string;

    @Column({ nullable: true })
    avatarUrl?: string;

    @CreateDateColumn()
    createdAt?: Date;
}
