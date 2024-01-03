import { Inject, Injectable, Scope } from '@nestjs/common';
import { AbstractDBService } from './abstract-db.service';
import { MongoDBException } from '@devseeder/microservices-exceptions';
import { ClientSession, ObjectId } from 'mongoose';
import {
  CloneManyResponse,
  CloneOneResponse,
} from '../../dto/response/clone.response';
import {
  ErrorService,
  GetTranslationService,
} from '@devseeder/nestjs-microservices-schemas';
import { REQUEST } from '@nestjs/core';
import {
  EntitySchema,
  FieldSchema,
} from '@devseeder/nestjs-microservices-schemas';
import { ErrorKeys } from '../../enum/error-keys.enum';
import { StringHelper } from '../../helper/string.helper';
import { GenericRepository } from '../../mongoose/generic.repository';
import { DependencyInjectorToken } from '../../app.constants';

@Injectable({ scope: Scope.REQUEST })
export class GenericCreateService<
  Collection,
  ResponseModel,
  BodyDto,
> extends AbstractDBService<Collection, Collection & Document, ResponseModel> {
  constructor(
    protected readonly repository: GenericRepository<Collection>,
    protected readonly entity: string,
    protected readonly fieldSchemaData: FieldSchema[],
    protected readonly entitySchemaData: EntitySchema[],
    protected readonly translationService?: GetTranslationService,
    protected readonly errorService?: ErrorService,
    @Inject(REQUEST) protected readonly request?: Request,
    @Inject(DependencyInjectorToken.SCOPE_KEY)
    protected readonly scopeKey?: string,
  ) {
    super(
      repository,
      entity,
      fieldSchemaData,
      entitySchemaData,
      translationService,
      errorService,
      request,
    );
  }

  async create(
    body: BodyDto,
    validateInput = true,
    session: ClientSession = null,
  ): Promise<{ _id: ObjectId }> {
    await this.convertRelation(body, validateInput);

    const bodyCreate = {
      ...this.getDynamicValues(body),
      active: true,
    };

    this.logger.log(`Body: ${JSON.stringify(bodyCreate)}`);

    try {
      const insertedId = await this.repository.insertOne(
        bodyCreate as Collection,
        this.entitySchema.itemLabel,
        session,
      );

      return { _id: insertedId };
    } catch (err) {
      if (err instanceof MongoDBException) {
        if (err.errCode === 11000) {
          const entityTranslation =
            await this.translationService.getEntityTranslation(
              this.entitySchema.entity,
            );

          this.errorService.throwError(ErrorKeys.ALREADY_EXISTS, {
            key: entityTranslation.itemLabel,
            value: body['name'],
          });
        }
      }
    }
  }

  async cloneOne(
    id: string,
    changeUniqueIndex = true,
    relationsToClone = [],
    cloneBody = {},
    session: ClientSession = null,
    validateInput = true,
  ): Promise<CloneOneResponse> {
    this.logger.log(`Cloning ${this.entitySchema.itemLabel} '${id}'...`);

    const cloneTarget = await this.validateId(id);

    await this.convertRelation(cloneBody, validateInput);

    const bodyCreate = {
      ...cloneTarget,
      active: true,
    };

    if (changeUniqueIndex) await this.getUniqueIndexToClone(bodyCreate);

    this.logger.log(`CloneBody ${JSON.stringify(cloneBody)}`);
    this.logger.log(`Body ${JSON.stringify({ ...bodyCreate, ...cloneBody })}`);

    const insertedId = await this.create(
      {
        ...bodyCreate,
        ...cloneBody,
      } as BodyDto,
      false,
      session,
    );

    await this.cloneRelations(
      id,
      insertedId._id.toString(),
      relationsToClone,
      session,
    );

    return insertedId;
  }

  async cloneByIds(
    ids: string[],
    relationsToClone = [],
    cloneBody = {},
  ): Promise<CloneManyResponse> {
    this.logger.log(
      `Cloning ${this.entitySchema.itemLabel} '${ids.join(',')}'...`,
    );
    const arrClone: ObjectId[] = [];

    try {
      const session = await this.repository.startTransaction();
      for await (const id of ids) {
        const insertedId = await this.cloneOne(
          id,
          true,
          relationsToClone,
          cloneBody,
          session,
        );
        arrClone.push(insertedId._id);
      }
      await this.repository.commit();
      this.logger.log('Clonning proccess finished');
    } catch (err) {
      this.logger.error(
        `Error while clonning, starting rollback for all itens`,
      );
      await this.repository.rollback();
      this.logger.error('Rollback finished for all itens');
      throw err;
    }

    return { _ids: arrClone };
  }

  private async cloneRelations(
    cloneId: string,
    newId: string,
    relationsToClone = [],
    session: ClientSession = null,
  ): Promise<void> {
    this.logger.log('Cloning relations ');
    const relations = this.entitySchema.subRelations.filter((sub) =>
      relationsToClone.length
        ? (relationsToClone.includes(sub.entity) ||
            relationsToClone[0] === '*') &&
          sub.clone
        : false,
    );
    this.logger.log(`Cloning ${relations.length} relations`);
    for await (const rel of relations) {
      this.logger.log(`Cloning relation '${rel.service}'...`);
      this.logger.log(
        `Service relation 'get${rel.entity.capitalizeFirstLetter()}Service'...`,
      );
      const data = await this[
        `get${rel.entity.capitalizeFirstLetter()}Service`
      ].search(
        {
          [rel.key]: cloneId,
          select: 'name',
        },
        false,
        false,
      );

      const { items: subItems } = data;

      this.logger.log(`${subItems.length} itens found for '${rel.entity}'...`);

      for await (const item of subItems) {
        await this[
          `create${rel.entity.capitalizeFirstLetter()}Service`
        ].cloneOne(
          item._id,
          false,
          '*',
          {
            [rel.key]: rel.array ? [newId] : newId,
          },
          session,
          false,
        );
      }
      this.logger.log(`Relation '${rel.service}' successfully cloned!`);
    }
  }

  private async getUniqueIndexToClone(bodyCreate: Collection & Document) {
    const objIndexes = await this.repository.getIndexes();
    delete objIndexes['_id_'];

    const mapKeys = Object.values(objIndexes).map((key) => key[0][0]);
    const randomId = StringHelper.generateRandomString(7);

    [...mapKeys, ...(this.entitySchema.copyFields || [])].forEach((key) => {
      if (typeof bodyCreate[key] == 'string')
        bodyCreate[key] = `${bodyCreate[key]}(copy ${randomId})`;
    });

    delete bodyCreate['_id'];
    delete bodyCreate['__v'];
    delete bodyCreate['createdAt'];
    delete bodyCreate['updatedAt'];
    delete bodyCreate['inactivationDate'];
    delete bodyCreate['inactivationReason'];
  }
}
