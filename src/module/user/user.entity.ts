import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { UserRole } from "../../common/enum/user-role.enum";
import { UserStatus } from "../../common/enum/user-status.enum";

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    userId: number;

    @Column({ unique: true, nullable: true })
    username: string | null;

    @Column()
    displayName: string;

    @Column({ nullable: true })
    sex: number | null;

    @Column({ unique: true, nullable: true })
    email: string | null;

    @Column({ type: "date", nullable: true })
    dateOfBirth: Date | null;

    @Column({ nullable: true })
    phone: string | null;

    @Column({ nullable: true })
    password: string | null;

    @Column({ nullable: true })
    avatarUrl: string | null;

    @Column({ default: false })
    isVerified: boolean;

    @Column({ nullable: true })
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