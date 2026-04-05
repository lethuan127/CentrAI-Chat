import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import type { RegisterDto, LoginDto, AuthResponse, TokenPair } from '@centrai/types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const workspace = await this.getOrCreateDefaultWorkspace();
    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: 'USER',
        authProvider: 'LOCAL',
        workspaceId: workspace.id,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role, workspace.id);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
      },
      tokens,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role, user.workspaceId);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
      },
      tokens,
    };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!stored.user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.generateTokens(stored.user.id, stored.user.email, stored.user.role, stored.user.workspaceId);
    await this.storeRefreshToken(stored.user.id, tokens.refreshToken);

    return tokens;
  }

  async validateOAuthUser(profile: {
    email: string;
    name?: string;
    avatar?: string;
    provider: 'GOOGLE' | 'GITHUB';
    oauthId: string;
  }): Promise<AuthResponse> {
    let user = await this.prisma.user.findFirst({
      where: {
        authProvider: profile.provider,
        oauthId: profile.oauthId,
      },
    });

    if (!user) {
      user = await this.prisma.user.findUnique({ where: { email: profile.email } });

      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            authProvider: profile.provider,
            oauthId: profile.oauthId,
            name: user.name || profile.name,
            avatar: user.avatar || profile.avatar,
            emailVerified: true,
          },
        });
      } else {
        const workspace = await this.getOrCreateDefaultWorkspace();
        user = await this.prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            avatar: profile.avatar,
            role: 'USER',
            authProvider: profile.provider,
            oauthId: profile.oauthId,
            emailVerified: true,
            workspaceId: workspace.id,
          },
        });
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role, user.workspaceId);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
      },
      tokens,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        authProvider: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, token: refreshToken, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  private async generateTokens(userId: string, email: string, role: string, workspaceId?: string): Promise<TokenPair> {
    const payload = { sub: userId, email, role, workspaceId };
    const accessExpSec = Math.floor(this.parseDuration(this.config.get('JWT_ACCESS_EXPIRATION', '15m')) / 1000);
    const refreshExpSec = Math.floor(this.parseDuration(this.config.get('JWT_REFRESH_EXPIRATION', '7d')) / 1000);

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: accessExpSec,
      }),
      this.jwt.signAsync(
        { ...payload, tokenType: 'refresh' },
        {
          secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
          expiresIn: refreshExpSec,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, token: string) {
    const refreshExpiration = this.config.get<string>('JWT_REFRESH_EXPIRATION', '7d');
    const expiresAt = new Date(Date.now() + this.parseDuration(refreshExpiration));

    await this.prisma.refreshToken.create({
      data: { userId, token, expiresAt },
    });
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000;

    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return value * (multipliers[unit] ?? 24 * 60 * 60 * 1000);
  }

  private async getOrCreateDefaultWorkspace() {
    let workspace = await this.prisma.workspace.findUnique({
      where: { slug: 'default' },
    });

    if (!workspace) {
      workspace = await this.prisma.workspace.create({
        data: { name: 'Default', slug: 'default' },
      });
    }

    return workspace;
  }
}
