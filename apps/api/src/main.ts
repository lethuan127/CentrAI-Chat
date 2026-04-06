import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { componentSchemas } from './common/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });

  const swaggerEnabled = config.get<string>('SWAGGER_ENABLED', 'true') !== 'false';

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('CentrAI-Chat API')
      .setDescription(
        'Centralized AI conversation platform — RESTful API for managing agents, ' +
        'providers, conversations, and admin operations.\n\n' +
        '**Base URL:** All endpoints are prefixed with `/api/v1`.\n\n' +
        '**Authentication:** Most endpoints require a Bearer JWT token. ' +
        'Obtain one via `POST /api/v1/auth/login` or `POST /api/v1/auth/register`.\n\n' +
        '**Response format:** All responses follow the envelope `{ data, error, meta }` pattern.',
      )
      .setVersion('1.0.0')
      .setLicense('MIT', 'https://opensource.org/licenses/MIT')
      .setContact('CentrAI-Chat', 'https://github.com/lethuan127/CentrAI-Chat', '')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Enter your JWT access token' },
        'bearer',
      )
      .addServer('http://localhost:4000', 'Local development')
      .addTag('Health', 'Liveness and readiness probes')
      .addTag('Auth', 'Registration, login, OAuth, token management')
      .addTag('Chat', 'Conversations and messaging (end-user)')
      .addTag('Agents', 'Agent CRUD and lifecycle (admin/developer)')
      .addTag('Providers', 'LLM provider management (admin)')
      .addTag('Admin', 'User management, analytics, audit log, settings (admin)')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);

    if (!document.components) document.components = {};
    if (!document.components.schemas) document.components.schemas = {};
    Object.assign(document.components.schemas, componentSchemas);

    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
        filter: true,
        tagsSorter: 'alpha',
        operationsSorter: 'method',
      },
      customSiteTitle: 'CentrAI-Chat API Docs',
    });

    console.log(`Swagger UI: http://localhost:${config.get<number>('API_PORT', 4000)}/api/docs`);
    console.log(`OpenAPI JSON: http://localhost:${config.get<number>('API_PORT', 4000)}/api/docs-json`);
  }

  const port = config.get<number>('API_PORT', 4000);
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

bootstrap();
