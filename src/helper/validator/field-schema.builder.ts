import { AnySchema, ObjectSchema, Root, SchemaMap } from 'joi';
import * as Joi from 'joi';
import { SchemaValidator } from './schema-validator.helper';
import {
  ErrorService,
  GLOBAL_ENTITY,
  GetTranslationService,
  SKIP_ENUMS,
  SKIP_ENUMS_ALIAS,
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

  cleanSchema(fieldSchema: FieldSchema[]): FieldSchema[] {
    return fieldSchema.filter((sch) => sch.key.indexOf('.') === -1);
  }

  buildSearchSchema(
    fieldSchema: FieldSchema[],
    commons: SchemaMap = {},
  ): ObjectSchema {
    const objectSchema: SchemaMap = {};

    this.cleanSchema(fieldSchema)
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

    this.cleanSchema(fieldSchema)
      .filter((field) => field.allowed.update)
      .forEach((schema) => {
        const joiSchema = this.getType(
          Joi,
          schema,
          false,
          schema?.array,
          fieldSchema,
        );
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

    this.cleanSchema(fieldSchema).forEach((schema) => {
      let joiSchema = this.getType(
        Joi,
        schema,
        false,
        schema?.array,
        fieldSchema,
      );
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
    schemasDb = [],
  ): AnySchema {
    switch (schema.type) {
      case 'text':
      case 'string':
      case 'password':
      case 'image':
      case 'link':
      case 'file':
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
      case 'currency':
      case 'decimal':
      case 'double':
      case 'integer':
        let joiSchema = Joi.number();
        if (schema.min !== undefined) joiSchema = joiSchema.min(schema.min);
        if (schema.max !== undefined) joiSchema = joiSchema.max(schema.max);
        return joiSchema;
      case 'date':
      case 'datetime':
        return Joi.alternatives().try(
          Joi.date().iso(),
          Joi.string().regex(/^@/),
        );
      case 'array':
        return search
          ? Joi.string()
          : this.buildArrayField(Joi, schema, search, schemasDb);
      case 'translation':
      case 'object':
      case 'json':
        const schemaObj = this.buildObjectFieldSchema(
          Joi,
          schema,
          search,
          schemasDb,
        );
        return schemaObj ? Joi.object(schemaObj) : Joi.object();
      default:
        this.errorService.throwError(ErrorKeys.NOT_IMPLEMENTED, {
          key: 'Schema type',
          value: schema.type,
        });
    }
  }

  buildArrayField(
    Joi: Root,
    schema: FieldSchema,
    search = false,
    schemasDb: FieldSchema[] = [],
  ): AnySchema {
    if ((schema.itensType as unknown) !== 'object') return Joi.array();
    const schemaObj = this.buildObjectFieldSchema(
      Joi,
      schema,
      search,
      schemasDb,
    );
    if (!schemaObj) return Joi.array();
    return Joi.array().items(Joi.object(schemaObj));
  }

  buildObjectFieldSchema(
    Joi: Root,
    schema: FieldSchema,
    search = false,
    schemasDb: FieldSchema[] = [],
  ): SchemaMap | null {
    if (!schemasDb.length) return null;
    const propObjFields = schemasDb.filter((sch) =>
      sch.key.startsWith(`${schema.key}.`),
    );
    if (!propObjFields.length) return null;
    const objSchema = {};
    propObjFields.forEach((prop) => {
      let propSchema = this.getType(Joi, prop, search, prop.array, schemasDb);
      if (prop.required) propSchema = propSchema.required();
      objSchema[prop.key.replace(`${schema.key}.`, '')] = propSchema;
    });
    return objSchema;
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
