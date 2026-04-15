
export class RegisterDto {
    emailOrPhone?: string;
    username: string;
    email: string;
    password: string;
    displayName: string;
    sex: number;
    dateOfBirth: Date;
    phone: string;
    avatarUrl?: string;
    fullName?: string;
    gender?: string;

    constructor(
        username: string,
        email: string,
        password: string,
        displayName: string,
        sex: number,
        dateOfBirth: Date,
        phone: string,
    ) {
        this.username = username;
        this.email = email;
        this.password = password;
        this.displayName = displayName;
        this.sex = sex;
        this.dateOfBirth = dateOfBirth;
        this.phone = phone;
    }
}