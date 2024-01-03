import { AnySchema, ObjectSchema, Root, SchemaMap } from 'joi';
import * as Joi from 'joi';
import { SchemaValidator } from './schema-validator.helper';
import {
  ErrorService,
  GLOBAL_ENTITY,
  GetTranslationService,
} from '@devseeder/nestjs-microservices-schemas';
import {
  EntitySchema,
  FieldSchema,
  SearchEgineOperators,
} from '@devseeder/nestjs-microservices-schemas';
import {
  InputSchema,
  RequestSchema,
} from '../../interface/input-schema.interface';
import { ErrorKeys } from '../../enum/error-keys.enum';
import { FieldSchemaPage } from '../../interface/field-schema.interface';
import {
  commonActivationSchema,
  commonGroupBySchema,
  commonSearchSchema,
  manyCloneSchema,
  singleCloneSchema,
} from '../../field-schemas/abstract-input.schema';
import { SKIP_ENUMS, SKIP_ENUMS_ALIAS } from '../../app.constants';

export class FieldSchemaBuilder {
  private schemaValidator: SchemaValidator;
  private entitySchema: EntitySchema;

  constructor(
    protected readonly errorService: ErrorService,
    translationService: GetTranslationService,
    entity: string,
    private readonly entitySchemaData: EntitySchema[],
  ) {
    this.entitySchema = entitySchemaData.filter(
      (ent) => ent.entity == entity,
    )[0];
    this.schemaValidator = new SchemaValidator(
      errorService,
      translationService,
      this.entitySchema,
      entitySchemaData,
    );
  }

  buildRequestSchemas(
    entityFields: FieldSchema[],
    fieldSchemaData: FieldSchema[],
  ): RequestSchema {
    const parentSchemas = {};
    const childrenSchemas = {};

    entityFields
      .filter((field) => field.type === 'externalId')
      .forEach((field) => {
        const relation = field.externalRelation.service;

        const entitySchema = this.entitySchemaData.filter(
          (sc) => sc.entity === relation,
        );

        parentSchemas[relation] = this.buildSchemas(
          fieldSchemaData.filter(
            (schema) =>
              (entitySchema[0].extendedEntities &&
                entitySchema[0].extendedEntities.includes(schema.entity)) ||
              schema.entity === GLOBAL_ENTITY ||
              schema.entity === relation,
          ),
        );
      });

    this.entitySchema.subRelations.forEach((sub) => {
      const relation = sub.service;
      const entitySchema = this.entitySchemaData.filter(
        (sc) => sc.entity === relation,
      );

      childrenSchemas[relation] = this.buildSchemas(
        fieldSchemaData.filter(
          (schema) =>
            (entitySchema[0].extendedEntities &&
              entitySchema[0].extendedEntities.includes(schema.entity)) ||
            schema.entity === GLOBAL_ENTITY ||
            schema.entity === relation,
        ),
      );
    });

    return {
      entity: this.buildSchemas(entityFields),
      parents: parentSchemas,
      children: childrenSchemas,
    };
  }

  buildSchemas(fieldSchema: FieldSchema[]): InputSchema {
    return {
      search: this.buildSearchSchema(fieldSchema, commonSearchSchema),
      update: this.buildUpdateSchema(fieldSchema),
      create: this.buildCreateSchema(fieldSchema),
      cloneOne: this.buildCloneSchema(fieldSchema, singleCloneSchema),
      cloneMany: this.buildCloneSchema(fieldSchema, manyCloneSchema),
      count: this.buildSearchSchema(fieldSchema),
      groupBy: this.buildSearchSchema(fieldSchema, commonGroupBySchema),
      activation: Joi.object({ ...commonActivationSchema }),
    };
  }

  buildSearchSchema(
    fieldSchema: FieldSchema[],
    commons: SchemaMap = {},
  ): ObjectSchema {
    const objectSchema: SchemaMap = {};

    fieldSchema
      .filter((field) => field.allowed.search)
      .forEach((schema) => {
        if (this.buildSearchEngine(schema, objectSchema)) return;

        const joiSchema = this.getType(Joi, schema, true);

        if (schema.type === 'enum')
          objectSchema[schema.key] = joiSchema
            .optional()
            .custom(this.schemaValidator.validateEnum(schema.enumValues));
        else objectSchema[schema.key] = joiSchema.optional();
      });
    return Joi.object({ ...commons, ...objectSchema });
  }

  buildUpdateSchema(fieldSchema: FieldSchema[]): ObjectSchema {
    return Joi.object(this.buildObjectUpdate(fieldSchema));
  }

  buildCloneSchema(
    fieldSchema: FieldSchema[],
    cloneSchema: SchemaMap,
  ): ObjectSchema {
    return Joi.object({
      ...cloneSchema,
      replaceBody: this.buildObjectUpdate(fieldSchema),
    });
  }

  buildObjectUpdate(fieldSchema: FieldSchema[]): SchemaMap {
    const objectSchema: SchemaMap = {};

    fieldSchema
      .filter((field) => field.allowed.update)
      .forEach((schema) => {
        const joiSchema = this.getType(Joi, schema, false, schema?.array);
        if (schema.type === 'enum')
          objectSchema[schema.key] = joiSchema
            .optional()
            .custom(this.schemaValidator.validateEnum(schema.enumValues));
        else objectSchema[schema.key] = joiSchema.optional();
      });
    return objectSchema;
  }

  buildCreateSchema(fieldSchema: FieldSchema[]): ObjectSchema {
    const objectSchema: SchemaMap = {};

    fieldSchema.forEach((schema) => {
      let joiSchema = this.getType(Joi, schema, false, schema?.array);
      joiSchema = schema.required ? joiSchema.required() : joiSchema.optional();
      if (schema.type === 'enum')
        objectSchema[schema.key] = joiSchema
          .optional()
          .custom(this.schemaValidator.validateEnum(schema.enumValues));
      else objectSchema[schema.key] = joiSchema;
    });
    return Joi.object(objectSchema);
  }

  getType(
    Joi: Root,
    schema: FieldSchema,
    search = false,
    array = false,
  ): AnySchema {
    switch (schema.type) {
      case 'text':
      case 'string':
      case 'password':
        return Joi.string();
      case 'email':
        return Joi.string().email();
      case 'externalId':
        return array ? Joi.array() : Joi.string();
      case 'enum':
        return schema.itensType === 'string' ? Joi.string() : Joi.number();
      case 'boolean':
        return Joi.boolean();
      case 'number':
      case 'double':
      case 'integer':
        let joiSchema = Joi.number();
        if (schema.min !== undefined) joiSchema = joiSchema.min(schema.min);
        if (schema.max !== undefined) joiSchema = joiSchema.max(schema.max);
        return joiSchema;
      case 'date':
        return Joi.alternatives().try(
          Joi.date().iso(),
          Joi.string().regex(/^@/),
        );
      case 'array':
        return search ? Joi.string() : Joi.array();
      case 'translation':
      case 'object':
      case 'json':
        return Joi.object();
      default:
        this.errorService.throwError(ErrorKeys.NOT_IMPLEMENTED, {
          key: 'Schema type',
          value: schema.type,
        });
    }
  }

  buildSearchEngine(schema: FieldSchema, objectSchema: SchemaMap): boolean {
    if (!schema?.searchEgines) return false;

    let ignoreOriginalKey = false;

    if (schema?.searchEgines.includes(SearchEgineOperators.BETWEEN)) {
      const start = this.getType(Joi, schema, true);
      const end = this.getType(Joi, schema, true);
      objectSchema[`${schema.key}_start`] = start.optional();
      objectSchema[`${schema.key}_end`] = end.optional();
      ignoreOriginalKey = true;
    }

    Object.values(SearchEgineOperators).forEach((op) => {
      if (SKIP_ENUMS.includes(op)) return;
      ignoreOriginalKey = false;
      const joiSchema = this.getType(Joi, schema, true);
      objectSchema[`${schema.key}_${op}`] = joiSchema.optional();
    });

    return ignoreOriginalKey;
  }

  getFormFilterCondition(page: string, field: FieldSchema): boolean {
    switch (page) {
      case FieldSchemaPage.SEARCH:
        return field.allowed.search;
      case FieldSchemaPage.UPDATE:
        return field.allowed.update;
      case FieldSchemaPage.CREATE:
        return true;
      default:
        this.errorService.throwError(ErrorKeys.INVALID_DATA, {
          key: 'page',
          value: page,
        });
    }
  }

  static checkUndefinedValue(
    value: any,
    schema: FieldSchema,
    itemResponse: any,
    operator: SearchEgineOperators,
  ): boolean {
    if (value === undefined && SKIP_ENUMS_ALIAS.includes(operator)) return true;

    if (
      itemResponse[`${schema.key}_${operator}`] === undefined &&
      !SKIP_ENUMS.includes(operator)
    )
      return true;

    return false;
  }
}
