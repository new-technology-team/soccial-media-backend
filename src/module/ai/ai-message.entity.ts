import { Entity, ObjectIdColumn, ObjectId, Column, CreateDateColumn } from "typeorm";

@Entity('ai_messages')
export class AiMessage {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  userId: number;

  @Column()
  role: 'user' | 'model';

  @Column()
  text: string;

  @CreateDateColumn()
  createdAt: Date;
}
