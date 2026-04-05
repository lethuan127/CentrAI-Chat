import { PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const errors = this.formatErrors(result.error);
      throw new BadRequestException({
        error: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors,
      });
    }
    return result.data;
  }

  private formatErrors(error: ZodError) {
    return error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  }
}
