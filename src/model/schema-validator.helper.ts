import { BadRequestException } from '@nestjs/common';
import { ObjectSchema } from 'joi';
import { StringHelper } from './string.helper';

export class SchemaValidator {
  static validateSchema(schema: ObjectSchema, obj: object) {
    const { error } = schema.validate(obj);
    if (error)
      throw new BadRequestException(
        StringHelper.capitalizeFirstLetter(error.message.replaceAll('"', '')),
      );
  }

  static validateEnum(values: any[]): any {
    return (value, helpers) => {
      if (!values.includes(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    };
  }

  static removeUndefined<FilteredObject>(obj: object): FilteredObject {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, value]) => value !== undefined),
    ) as FilteredObject;
  }
}
