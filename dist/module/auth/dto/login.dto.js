"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginDto = void 0;
class LoginDto {
    emailOrPhone;
    email;
    phone;
    username;
    password;
    constructor(username, password) {
        this.username = username;
        this.password = password;
    }
}
exports.LoginDto = LoginDto;
//# sourceMappingURL=login.dto.js.map