import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authorization = String(request.headers?.authorization || '');

    if (!authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authorization.slice(7).trim();
    try {
      request.user = this.jwtService.verify(token, {
        secret: process.env.JWT_ACCESS_SECRET || 'secretKey',
      });
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
