
export class RegisterDto {
    username: string;
    email: string;
    password: string;
    displayName: string;
    sex: number;
    phone: string;

    constructor(
        username: string,
        email: string,
        password: string,
        displayName: string,
        sex: number,
        phone: string,
        avatarUrl: string
    ) {
        this.username = username;
        this.email = email;
        this.password = password;
        this.displayName = displayName;
        this.sex = sex;
        this.phone = phone;
    }
}