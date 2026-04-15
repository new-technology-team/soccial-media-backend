"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegisterDto = void 0;
class RegisterDto {
    emailOrPhone;
    username;
    email;
    password;
    displayName;
    sex;
    dateOfBirth;
    phone;
    avatarUrl;
    fullName;
    gender;
    constructor(username, email, password, displayName, sex, dateOfBirth, phone) {
        this.username = username;
        this.email = email;
        this.password = password;
        this.displayName = displayName;
        this.sex = sex;
        this.dateOfBirth = dateOfBirth;
        this.phone = phone;
    }
}
exports.RegisterDto = RegisterDto;
//# sourceMappingURL=register.dto.js.map