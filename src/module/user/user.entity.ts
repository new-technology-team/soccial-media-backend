import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { UserRole } from "../../common/enum/user-role.enum";
import { UserStatus } from "../../common/enum/user-status.enum";

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    userId: number;

    @Column({ type: 'varchar', length: 50, unique: true, nullable: true })
    username: string | null;

    @Column({ type: 'varchar', length: 100 })
    displayName: string;

    @Column({ type: 'tinyint', nullable: true })
    sex: number | null;

    @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
    email: string | null;

    @Column({ type: "date", nullable: true })
    dateOfBirth: Date | null;

    @Column({ type: 'varchar', length: 20, nullable: true })
    phone: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    password: string | null;

    @Column({ type: 'varchar', length: 500, nullable: true })
    avatarUrl: string | null;

    @Column({ default: false })
    isVerified: boolean;

    @Column({ type: 'text', nullable: true })
    refreshToken: string | null;

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

    @Column({
        type: "enum",
        enum: UserRole,
        default: UserRole.USER
    })
    role: UserRole;

    @Column({
        type: "enum",
        enum: UserStatus,
        default: UserStatus.ACTIVE
    })
    status: UserStatus;
}