import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { UserRole } from "../../common/enum/user-role.enum";
import { UserStatus } from "../../common/enum/user-status.enum";

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    userId: number;

    @Column({ unique: true })
    username: string;

    @Column()
    displayName: string;

    @Column({ nullable: true })
    sex: number;

    @Column({ unique: true })
    email: string;

    @Column({ type: "date", nullable: true })
    dateOfBirth: Date;

    @Column({ nullable: true })
    phone: string;

    @Column()
    password: string;

    @Column({ nullable: true })
    avatarUrl: string;

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

    constructor(
        userId: number,
        username: string,
        displayName: string,
        sex: number,
        email: string,
        dateOfBirth: Date,
        phone: string,
        password: string,
        avatarUrl: string,
        role: UserRole,
        status: UserStatus
    ) {
        this.userId = userId;
        this.username = username;
        this.displayName = displayName;
        this.sex = sex;
        this.email = email;
        this.dateOfBirth = dateOfBirth;
        this.phone = phone;
        this.password = password;
        this.avatarUrl = avatarUrl;
        this.role = role;
        this.status = status;
    }
}