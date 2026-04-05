import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  UsePipes,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { registerSchema, loginSchema, refreshTokenSchema } from '@centrai/types';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { RegisterDto, LoginDto, RefreshTokenDto } from '@centrai/types';

interface JwtUser {
  id: string;
  email: string;
  role: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new account with email and password' })
  @ApiResponse({ status: 201, description: 'Account created' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  @UsePipes(new ZodValidationPipe(registerSchema))
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return { data: result, error: null };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return { data: result, error: null };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  @UsePipes(new ZodValidationPipe(refreshTokenSchema))
  async refresh(@Body() dto: RefreshTokenDto) {
    const tokens = await this.authService.refreshTokens(dto.refreshToken);
    return { data: { tokens }, error: null };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke refresh tokens and log out' })
  async logout(
    @CurrentUser() user: JwtUser,
    @Body('refreshToken') refreshToken?: string,
  ) {
    await this.authService.logout(user.id, refreshToken);
    return { data: { message: 'Logged out' }, error: null };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  async me(@CurrentUser() user: JwtUser) {
    const profile = await this.authService.getProfile(user.id);
    return { data: profile, error: null };
  }

  // ─── OAuth: Google ──────────────────────────────────────

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  googleLogin() {
    // Passport redirects to Google
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const tokens = req.user as { accessToken: string; refreshToken: string };
    const frontendUrl = this.config.get<string>('CORS_ORIGIN', 'http://localhost:3000');
    res.redirect(
      `${frontendUrl}/callback#accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`,
    );
  }

  // ─── OAuth: GitHub ──────────────────────────────────────

  @Public()
  @Get('github')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'Initiate GitHub OAuth flow' })
  githubLogin() {
    // Passport redirects to GitHub
  }

  @Public()
  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    const tokens = req.user as { accessToken: string; refreshToken: string };
    const frontendUrl = this.config.get<string>('CORS_ORIGIN', 'http://localhost:3000');
    res.redirect(
      `${frontendUrl}/callback#accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`,
    );
  }
}
