import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('saved_posts')
@Index(['userId', 'postId'], { unique: true })
export class SavedPost {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId: number;

    @Column({ type: 'varchar', length: 64 })
    postId: string;

    @CreateDateColumn()
    createdAt: Date;
}
