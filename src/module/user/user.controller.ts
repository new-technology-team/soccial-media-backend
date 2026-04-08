import { Controller, Post, Body, Get } from "@nestjs/common";
import { UserService } from "./user.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { User } from "./user.entity";

@Controller('user')
export class UserController {
    constructor(private userService: UserService) { }
}