import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { UserRole } from '../../common/enum/user-role.enum';
import { UserStatus } from '../../common/enum/user-status.enum';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn()
  userId: number;

  @Index({ unique: true })
  @Column({ name: 'username' })
  username: string;

  @Column({ name: 'displayName' })
  fullName: string;

  @Column({ nullable: true })
  sex: number;

  @Column({ name: 'email' })
  email: string;

  @Column({ type: 'date', nullable: true, name: 'dateOfBirth' })
  dateOfBirth: Date;

  @Column({ nullable: true })
  phone: string;

  @Column()
  password: string;

  @Column({ nullable: true, name: 'avatarUrl' })
  avatarUrl: string;

  @Column({ nullable: true, name: 'coverUrl' })
  coverUrl: string;

  @Column({ type: 'enum', enum: ['ADMIN', 'USER'], default: 'USER' })
  role: string;

  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'BLOCKED', 'RESTRICTED', 'HIDDEN'],
    default: 'ACTIVE',
  })
  status: string;

  @Column({ default: true })
  privacyLastSeen: boolean;

  @Column({ default: true })
  privacyProfilePhoto: boolean;

  @Column({ default: true })
  allowFriendRequests: boolean;

  @Column({ default: true })
  notificationMessages: boolean;

  @Column({ default: true })
  notificationCalls: boolean;

  @Column({ type: 'timestamp', nullable: true, name: 'lockedUntil' })
  lockedUntil: Date;

  @Column({ nullable: true, length: 500 })
  bio: string;

  @Column({ nullable: true, length: 200 })
  location: string;
}
