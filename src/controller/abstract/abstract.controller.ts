import {
  ErrorService,
  GetTranslationService,
} from '@devseeder/nestjs-microservices-schemas';
import {
  EntitySchema,
  FieldSchema,
} from '@devseeder/nestjs-microservices-schemas';
import { Search } from '../../dto';
import { AbstractBodyDto } from '../../dto/body/abtract-body.dto';
import { ErrorKeys } from '../../enum/error-keys.enum';
import { FieldSchemaBuilder } from '../../helper/validator/field-schema.builder';
import { SchemaValidator } from '../../helper/validator/schema-validator.helper';
import { RequestSchema } from '../../interface/input-schema.interface';
import { AbstractEntityLoader } from '../../loader/abstract-entity.loader';

export abstract class AbstractController<
  Collection,
  GetResponse,
  SearchParams extends Search,
  BodyDto extends AbstractBodyDto,
> extends AbstractEntityLoader {
  requestSchema: RequestSchema;
  schemaValidator: SchemaValidator;

  constructor(
    readonly entity: string,
    readonly fieldSchemaData?: FieldSchema[],
    readonly entitySchemaData?: EntitySchema[],
    readonly errorService?: ErrorService,
    readonly translationService?: GetTranslationService,
  ) {
    super(entity, fieldSchemaData, entitySchemaData);

    this.requestSchema = new FieldSchemaBuilder(
      errorService,
      translationService,
      entity,
      entitySchemaData,
    ).buildRequestSchemas(this.fieldSchemaDb, this.fieldSchemaData);

    this.schemaValidator = new SchemaValidator(
      errorService,
      translationService,
      this.entitySchema,
      this.entitySchemaData,
    );
  }

  isMethodAllowed(method: string) {
    if (!this.entitySchema.forbiddenMethods) return;
    const notAllowed = this.entitySchema.forbiddenMethods.filter(
      (m) => m === method,
    );
    if (notAllowed.length)
      this.errorService.throwError(ErrorKeys.METHOD_NOT_ALLOWED);
  }
}
