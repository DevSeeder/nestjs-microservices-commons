import {
  EntitySchema,
  FieldSchema,
  GLOBAL_ENTITY,
} from '@devseeder/nestjs-microservices-schemas';
import { Logger, NotAcceptableException } from '@nestjs/common';

export abstract class AbstractEntityLoader {
  readonly logger: Logger = new Logger(AbstractEntityLoader.name);
  entitySchema: EntitySchema;
  entityLabels: string[];
  fieldSchemaDb: FieldSchema[];

  constructor(
    protected readonly entity: string,
    protected readonly fieldSchemaData?: FieldSchema[],
    protected readonly entitySchemaData?: EntitySchema[],
  ) {
    const filterEntity = entitySchemaData.filter(
      (ent) => ent.entity === entity,
    );
    if (!filterEntity.length)
      throw new NotAcceptableException(`No entity found for ${entity}`);

    this.entitySchema = filterEntity[0];

    this.entityLabels = [
      this.entitySchema.entity,
      ...(this.entitySchema.extendedEntities || []),
    ];

    if (!this.fieldSchemaData || !this.fieldSchemaData.length) return;

    this.fieldSchemaDb = this.fieldSchemaData.filter(
      (schema) =>
        this.entityLabels.includes(schema.entity) ||
        schema.entity === GLOBAL_ENTITY ||
        schema.entity === this.entitySchema.entity,
    );
  }
}
