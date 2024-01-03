import { Inject, Injectable, Scope } from '@nestjs/common';
import { AbstractBodyDto } from '../../dto/body/abtract-body.dto';
import { AbstractSearchService } from './abstract-search.service';
import {
  ErrorService,
  GetTranslationService,
} from '@devseeder/nestjs-microservices-schemas';
import { ClientSession } from 'mongoose';
import { REQUEST, Reflector } from '@nestjs/core';
import {
  EntitySchema,
  FieldSchema,
} from '@devseeder/nestjs-microservices-schemas';
import { AbstractSchema } from '../../schema/abstract.schema';
import { ErrorKeys } from '../../enum/error-keys.enum';
import { DateHelper } from '../../helper';
import { InactivationReason } from '../../enum/inactivation-reason.enum';
import { GenericRepository } from '../../mongoose/generic.repository';
import { DependencyInjectorToken } from '../../app.constants';

@Injectable({ scope: Scope.REQUEST })
export class GenericUpdateService<
  Collection,
  ResponseModel,
  BodyDto extends AbstractBodyDto,
  SearchParams,
> extends AbstractSearchService<
  Collection,
  Collection & Document,
  ResponseModel,
  SearchParams
> {
  constructor(
    protected readonly repository: GenericRepository<Collection>,
    protected readonly entity: string,
    protected readonly fieldSchemaData: FieldSchema[],
    protected readonly entitySchemaData: EntitySchema[],
    protected readonly translationService?: GetTranslationService,
    protected readonly errorService?: ErrorService,
    @Inject(REQUEST) protected readonly request?: Request,
    protected readonly reflector?: Reflector,
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

  async updateById(
    id: string,
    body: Partial<BodyDto> | Partial<AbstractSchema>,
    session: ClientSession = null,
  ): Promise<void> {
    if (!body || !Object.keys(body).length)
      this.errorService.throwError(ErrorKeys.EMPTY_BODY);

    this.logger.log(`Updating record by id '${id}'`);

    await this.validateId(id);
    await this.convertRelation(body);

    this.logger.log(`Body: ${JSON.stringify(body)}`);

    await this.repository.updateOneById(id, body, session);
  }

  async activation(
    id: string,
    activation: boolean,
    cascadeRelations = '',
    reason = InactivationReason.MANUAL,
  ): Promise<void> {
    const body: Partial<AbstractSchema> = {
      active: activation,
      inactivationReason: !activation ? reason : null,
      inactivationDate: !activation ? DateHelper.getDateNow() : null,
    };

    const session = await this.repository.startTransaction();
    try {
      await this.updateById(id, body, session);

      if (!cascadeRelations.length) {
        this.logger.log(`No cascade relations`);
        await this.repository.commit();
        return;
      }

      await this.cascadeUpdate(
        id,
        body,
        !activation,
        cascadeRelations,
        session,
      );

      await this.repository.commit();
    } catch (err) {
      await this.repository.rollback();
      throw err;
    }
  }

  async cascadeUpdate(
    id: string,
    body: Partial<AbstractSchema>,
    active: boolean,
    cascadeRelations = '*',
    session: ClientSession = null,
  ): Promise<void> {
    const relations = this.entitySchema.subRelations.filter(
      (ent) =>
        cascadeRelations === '*' ||
        (cascadeRelations && cascadeRelations.split(',').includes(ent.entity)),
    );

    if (cascadeRelations && cascadeRelations.length && cascadeRelations !== '*')
      cascadeRelations.split(',').forEach((rel) => {
        const foundRelation = this.entitySchema.subRelations.filter(
          (sub) => sub.entity === rel,
        );

        if (!foundRelation.length)
          this.errorService.throwError(ErrorKeys.INVALID_DATA, {
            key: 'Relation',
            value: rel,
          });
      });

    for await (const rel of relations) {
      this.logger.log(
        `Service relation 'get${rel.entity.capitalizeFirstLetter()}Service'...`,
      );
      const data = await this[
        `get${rel.entity.capitalizeFirstLetter()}Service`
      ].search(
        {
          [rel.key]: id,
          select: 'name',
          active,
        },
        false,
        false,
      );

      const { items: subItems } = data;

      this.logger.log(`${subItems.length} itens found for '${rel.entity}'...`);

      for await (const item of subItems) {
        this.logger.log(`Updating ${item._id} ${JSON.stringify(body)}...`);

        await this[
          `update${rel.entity.capitalizeFirstLetter()}Service`
        ].updateById(item._id, body, session);
      }
      this.logger.log(`Relation '${rel.service}' successfully updated!`);
    }
  }

  async updateBy(
    search: SearchParams,
    body: Partial<BodyDto> | Partial<AbstractSchema>,
  ): Promise<void> {
    if (!body || !Object.keys(body).length)
      this.errorService.throwError(ErrorKeys.EMPTY_BODY);

    this.logger.log(`Updating records by '${JSON.stringify(search)}'`);

    const searchWhere = await this.buildSearchParams(search);

    const items = await this.repository.count(searchWhere);

    if (items <= 0) this.errorService.throwError(ErrorKeys.NO_RECORD_UPDATE);

    this.logger.log(`Body: ${JSON.stringify(body)}`);

    await this.validateLoggedUserByCount(items, searchWhere);

    await this.convertRelation(body);

    try {
      await this.repository.updateMany(searchWhere, body);
    } catch (err) {
      this.errorService.throwError(ErrorKeys.ALREADY_UPDATED);
    }
  }
}
