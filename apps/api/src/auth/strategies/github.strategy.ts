import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { AuthService } from '../auth.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    private readonly authService: AuthService,
    config: ConfigService,
  ) {
    super({
      clientID: config.get<string>('GITHUB_CLIENT_ID', 'not-configured'),
      clientSecret: config.get<string>('GITHUB_CLIENT_SECRET', 'not-configured'),
      callbackURL: config.get<string>(
        'GITHUB_CALLBACK_URL',
        'http://localhost:4000/api/v1/auth/github/callback',
      ),
      scope: ['user:email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: { id: string; emails?: { value: string }[]; displayName?: string; photos?: { value: string }[]; username?: string },
    done: (err: Error | null, user?: unknown) => void,
  ) {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      return done(new Error('No email from GitHub'));
    }

    const result = await this.authService.validateOAuthUser({
      email,
      name: profile.displayName || profile.username,
      avatar: profile.photos?.[0]?.value,
      provider: 'GITHUB',
      oauthId: profile.id,
    });

    done(null, result.tokens);
  }
}
