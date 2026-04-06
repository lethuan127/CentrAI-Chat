import { type SchemaObject } from '@nestjs/swagger';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodType } from 'zod';
import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiResponse as SwaggerApiResponse } from '@nestjs/swagger';

export function zodToOpenApi(schema: ZodType): SchemaObject {
  const jsonSchema = zodToJsonSchema(schema, {
    target: 'openApi3',
    $refStrategy: 'none',
  });
  const { $schema, ...rest } = jsonSchema as Record<string, unknown>;
  return rest as SchemaObject;
}

export function apiEnvelopeSchema(dataSchema: SchemaObject): SchemaObject {
  return {
    type: 'object',
    properties: {
      data: dataSchema,
      error: { type: 'string', nullable: true, example: null },
      meta: {
        type: 'object',
        nullable: true,
        properties: {
          total: { type: 'number' },
          page: { type: 'number' },
          limit: { type: 'number' },
          totalPages: { type: 'number' },
        },
      },
    },
    required: ['data', 'error'],
  } as SchemaObject;
}

export function ApiZodBody(schema: ZodType, description?: string) {
  return applyDecorators(
    ApiBody({ schema: zodToOpenApi(schema), description }),
  );
}

export function ApiOkEnvelope(dataSchema: SchemaObject, description?: string) {
  return applyDecorators(
    SwaggerApiResponse({
      status: 200,
      description,
      schema: apiEnvelopeSchema(dataSchema),
    }),
  );
}

export function ApiCreatedEnvelope(
  dataSchema: SchemaObject,
  description?: string,
) {
  return applyDecorators(
    SwaggerApiResponse({
      status: 201,
      description,
      schema: apiEnvelopeSchema(dataSchema),
    }),
  );
}
