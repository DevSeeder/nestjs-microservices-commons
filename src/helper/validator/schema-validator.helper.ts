import { Logger } from '@nestjs/common';
import { ObjectSchema, ValidationError, number } from 'joi';
import { ComparatorHelper } from './comparator.helper';
import {
  ErrorService,
  GetTranslationService,
  ErrorSchemaException,
  GLOBAL_ENTITY,
} from '@devseeder/nestjs-microservices-schemas';
import {
  EntitySchema,
  FieldSchema,
} from '@devseeder/nestjs-microservices-schemas';
import {
  InputSchema,
  RequestSchema,
} from '../../interface/input-schema.interface';
import { StringHelper } from '../string.helper';
import { SearchEncapsulatorHelper } from '../search/search-encapsulator.helper';
import { DynamicValueService } from '../../service/dynamic/get-dynamic-value.service';

export class SchemaValidator {
  private logger = new Logger(SchemaValidator.name);
  constructor(
    private readonly errorService: ErrorService,
    private readonly translationService: GetTranslationService,
    private readonly entitySchema: EntitySchema,
    private readonly entitySchemaData?: EntitySchema[],
  ) {}

  async validateRequestSchema(
    schema: RequestSchema,
    requestMethod: string,
    obj: any,
    fieldSchemasDb: FieldSchema[] = [],
    encapsulate = false,
  ) {
    await this.validateSchema(
      schema.entity[requestMethod],
      obj,
      fieldSchemasDb.filter(
        (schema) =>
          (this.entitySchema.extendedEntities &&
            this.entitySchema.extendedEntities.includes(schema.entity)) ||
          schema.entity === GLOBAL_ENTITY ||
          schema.entity === this.entitySchema.entity,
      ),
      encapsulate,
    );

    if (!['search', 'count', 'groupBy'].includes(requestMethod)) return;

    await this.validateFamilySchema(
      schema.parents,
      requestMethod,
      obj,
      fieldSchemasDb,
      encapsulate,
    );

    await this.validateFamilySchema(
      schema.children,
      requestMethod,
      obj,
      fieldSchemasDb,
      encapsulate,
    );
  }

  async validateFamilySchema(
    schemaRelation: InputSchema,
    requestMethod: string,
    obj: object,
    fieldSchemasDb: FieldSchema[],
    encapsulate = false,
  ): Promise<void> {
    for await (const relation of Object.keys(schemaRelation)) {
      const entitySchema = this.entitySchemaData.filter(
        (entSchema) => entSchema.entity === relation,
      );

      await this.validateSchema(
        schemaRelation[relation][requestMethod],
        SearchEncapsulatorHelper.buildFamilyEncapsulator(obj, relation),
        fieldSchemasDb.filter(
          (schema) =>
            (entitySchema[0].extendedEntities &&
              entitySchema[0].extendedEntities.includes(schema.entity)) ||
            schema.entity === GLOBAL_ENTITY ||
            schema.entity === relation,
        ),
        encapsulate,
      );
    }
  }

  async validateSchema(
    schema: ObjectSchema,
    obj: object,
    fieldSchemasDb: FieldSchema[] = [],
    encapsulate = false,
  ) {
    if (!encapsulate)
      await this.validateSingleSchema(schema, obj, fieldSchemasDb);

    const arrToValidate = SearchEncapsulatorHelper.cleanToValidateSchema(obj);
    this.logger.log(`Array To Validate: ${JSON.stringify(arrToValidate)}`);

    for await (const objItem of arrToValidate)
      await this.validateSingleSchema(schema, objItem, fieldSchemasDb);
  }

  async validateSingleSchema(
    schema: ObjectSchema,
    obj: object,
    fieldSchemasDb: FieldSchema[] = [],
  ) {
    const { error } = schema.validate(obj, {
      messages: await this.errorService.getJoiErrors(),
    });

    if (error) await this.printSchemaError(error, fieldSchemasDb);

    const validationSchemas = fieldSchemasDb.filter(
      (field) =>
        obj[field.key] !== undefined &&
        field.validations &&
        field.validations.length,
    );

    for await (const fieldSchema of validationSchemas)
      await this.executeValidationField(fieldSchema, obj);
  }

  validateEnum(values: any[]): any {
    return (value, helpers) => {
      if (!values.includes(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    };
  }

  async executeValidationField(
    schema: FieldSchema,
    item: object,
  ): Promise<void> {
    if (!schema.validations || !schema.validations.length) return;

    for await (const val of schema.validations) {
      const value = DynamicValueService.getDynamicValue(
        val.value,
        val.value,
        item,
      );
      const isValid = ComparatorHelper.compare(
        item[schema.key],
        value,
        val.operator,
        schema.type,
      );

      if (!isValid) {
        const compHelper = new ComparatorHelper(
          this.errorService,
          this.translationService,
          [schema.entity],
        );
        await compHelper.getComparatorError(
          schema.key,
          val.value,
          val.operator,
        );
      }
    }
  }

  private async printSchemaError(
    error: ValidationError,
    fieldSchemas: FieldSchema[],
  ): Promise<void> {
    this.logger.error(JSON.stringify(error));

    let message = error.message;

    const translate = StringHelper.extractKey(
      error.message,
      /@translate\(([^)]+)\)/,
    );

    if (translate) {
      const translateKey = translate
        .replaceAll('"', '')
        .replace(/\[\d+\]/g, '');
      const fieldTranslation =
        await this.translationService.getFieldTranslation(
          [fieldSchemas.filter((sch) => sch.key === translateKey)[0].entity],
          translateKey,
        );
      message = message.replaceAll(
        `@translate(${translate})`,
        fieldTranslation.fieldLabel,
      );
    }

    const errorSchema = this.errorService.getJoiErrorByType(
      error['details'][0].type,
    );

    throw new ErrorSchemaException(
      StringHelper.capitalizeFirstLetter(message.replaceAll('"', '')),
      errorSchema.httpStatus,
      errorSchema.code,
      errorSchema.name,
    );
  }

  static removeUndefined<FilteredObject>(obj: object): FilteredObject {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, value]) => value !== undefined),
    ) as FilteredObject;
  }
}
