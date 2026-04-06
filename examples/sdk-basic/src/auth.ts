/**
 * Example: Authentication flow using @centrai/sdk
 *
 * Demonstrates: register, login, get profile, refresh tokens, logout.
 */
import { CentrAI, HttpError } from '@centrai/sdk';

const BASE_URL = process.env.CENTRAI_URL ?? 'http://localhost:4000';
const EMAIL = process.env.CENTRAI_EMAIL ?? 'admin@example.com';
const PASSWORD = process.env.CENTRAI_PASSWORD ?? 'Admin123!';

async function main() {
  const client = new CentrAI({ baseUrl: BASE_URL });

  // ── Try registering (will 409 if already exists) ──
  try {
    const registered = await client.auth.register({
      email: EMAIL,
      password: PASSWORD,
      name: 'SDK Example User',
    });
    console.log('Registered:', registered.user.email);
    client.setAccessToken(registered.tokens.accessToken);
  } catch (err) {
    if (err instanceof HttpError && err.status === 409) {
      console.log('User already exists, logging in...');
    } else {
      throw err;
    }
  }

  // ── Login ──
  const { user, tokens } = await client.auth.login({ email: EMAIL, password: PASSWORD });
  client.setAccessToken(tokens.accessToken);
  console.log(`Logged in as ${user.name} (${user.role})`);

  // ── Get profile ──
  const profile = await client.auth.me();
  console.log('Profile:', { id: profile.id, email: profile.email, role: profile.role });

  // ── Refresh tokens ──
  const refreshed = await client.auth.refresh(tokens.refreshToken);
  client.setAccessToken(refreshed.tokens.accessToken);
  console.log('Tokens refreshed');

  // ── Logout ──
  await client.auth.logout(refreshed.tokens.refreshToken);
  console.log('Logged out');
}

main().catch(console.error);
