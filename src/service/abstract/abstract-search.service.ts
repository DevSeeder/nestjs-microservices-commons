import { SchemaValidator } from '../../helper/validator/schema-validator.helper';
import { FieldSchemaBuilder } from '../../helper/validator/field-schema.builder';
import { AbstractDBService } from './abstract-db.service';
import { SearchEncapsulatorHelper } from '../../helper/search/search-encapsulator.helper';
import {
  ErrorService,
  GetTranslationService,
} from '@devseeder/nestjs-microservices-schemas';
import { REQUEST } from '@nestjs/core';
import { Inject } from '@nestjs/common';
import {
  EntitySchema,
  FieldSchema,
  SearchEgineOperators,
} from '@devseeder/nestjs-microservices-schemas';
import { ErrorKeys } from '../../enum/error-keys.enum';
import { GenericRepository } from '../../mongoose/generic.repository';
import { DependencyInjectorToken } from '../../app.constants';
import { Search } from '../../dto';

export class AbstractSearchService<
  Collection,
  MongooseModel,
  ResponseModel,
  SearchParams extends Search,
> extends AbstractDBService<Collection, MongooseModel, ResponseModel> {
  constructor(
    protected readonly repository: GenericRepository<Collection>,
    protected readonly entity: string,
    protected readonly fieldSchemaData: FieldSchema[] = [],
    protected readonly entitySchemaData: EntitySchema[] = [],
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

  protected async buildSearchEgines(
    item: SearchParams,
  ): Promise<Partial<SearchParams>> {
    if (!item) return null;

    const itemResponse = { ...item };
    const searchEngines = this.fieldSchemaDb.filter(
      (schema) => schema.searchEgines && schema.searchEgines.length,
    );

    for (const schema of searchEngines) {
      const value = item[schema.key];
      schema.searchEgines.forEach((eng) => {
        this.buildSearchEgineItem(value, schema, eng, itemResponse);
      });
    }

    if (item['_ids']) {
      itemResponse['_id'] = await this.validateIdsSearch(item['_ids']);
      delete itemResponse['_ids'];
    }

    return SchemaValidator.removeUndefined<SearchParams>(
      itemResponse as object,
    );
  }

  private async validateIdsSearch(
    idsValue: string,
  ): Promise<object | undefined> {
    const ids = idsValue.split(',');

    for await (const id of ids) {
      let res;
      try {
        res = await this.repository.find({ _id: ids }, { name: 1 });
      } catch (err) {
        this.errorService.throwError(ErrorKeys.INVALID_DATA, {
          key: 'Id',
          value: id,
        });
      }
      if (!res.length)
        this.errorService.throwError(ErrorKeys.INVALID_DATA, {
          key: 'Id',
          value: id,
        });
    }

    return {
      $in: ids,
    };
  }

  private buildSearchEgineItem(
    value: any,
    schema: FieldSchema,
    operator: SearchEgineOperators,
    itemResponse: SearchParams,
  ) {
    if (
      FieldSchemaBuilder.checkUndefinedValue(
        value,
        schema,
        itemResponse,
        operator,
      )
    )
      return;

    switch (operator) {
      case SearchEgineOperators.LIKE:
        itemResponse[schema.key] = {
          $regex: new RegExp(`${itemResponse[`${schema.key}_like`]}`),
          $options: 'i',
        };
        delete itemResponse[`${schema.key}_like`];
        break;
      case SearchEgineOperators.IN:
        itemResponse[schema.key] = {
          $in: value.split(','),
        };
        break;

      case SearchEgineOperators.NOT_IN:
        itemResponse[schema.key] = {
          $nin: itemResponse[`${schema.key}_nin`].split(','),
        };
        delete itemResponse[`${schema.key}_nin`];
        break;

      case SearchEgineOperators.BETWEEN:
        const betweenQuery = {};
        if (itemResponse[`${schema.key}_start`])
          betweenQuery['$gte'] = itemResponse[`${schema.key}_start`];
        if (itemResponse[`${schema.key}_end`])
          betweenQuery['$lte'] = itemResponse[`${schema.key}_end`];

        if (Object.keys(betweenQuery).length)
          itemResponse[schema.key] = betweenQuery;

        delete itemResponse[`${schema.key}_start`];
        delete itemResponse[`${schema.key}_end`];
        break;

      default:
        const operatorQuery = {};
        if (itemResponse[`${schema.key}_${operator}`])
          operatorQuery[`$${operator}`] =
            itemResponse[`${schema.key}_${operator}`];

        if (Object.keys(operatorQuery).length)
          itemResponse[schema.key] = operatorQuery;

        delete itemResponse[`${schema.key}_${operator}`];
        break;
    }
  }

  protected async buildSearchParams(
    searchParams: SearchParams,
  ): Promise<Partial<SearchParams>> {
    const encapObjects = SearchEncapsulatorHelper.buildEncapsulatedSearch(
      this.getDynamicValues(searchParams),
    );

    const andParams = [];
    for await (const clauseGroup of encapObjects['$and']) {
      const group = await this.buildSearchGroup(clauseGroup as SearchParams);
      if (!group) continue;
      andParams.push(group);
    }

    const orParams = [];
    for await (const clauseGroup of encapObjects['$or']) {
      const group = await this.buildSearchGroup(clauseGroup as SearchParams);
      if (!group) continue;
      orParams.push(group);
    }

    const params = await this.buildSearchGroup({
      ...encapObjects,
      $and: undefined,
      $or: undefined,
    } as unknown as SearchParams);

    if (andParams.length) params['$and'] = andParams;
    if (orParams.length) params['$or'] = orParams;

    return {
      ...params,
      active: params && params.active !== undefined ? params.active : true,
    };
  }

  protected async buildSearchGroup(
    searchParams: SearchParams,
  ): Promise<Partial<SearchParams>> {
    await this.convertRelation(
      searchParams as unknown as Partial<MongooseModel>,
    );
    const searchEngs = await this.buildSearchEgines(searchParams);
    await this.joinParentSearch(searchEngs as SearchParams);
    await this.joinChildrenSearch(searchEngs as SearchParams);
    return searchEngs;
  }

  protected validateOrderField(
    item: Partial<SearchParams>,
    orderBy = null,
    orderMode = 1,
  ): { sort: object; sortExternal: object; hasExternal: boolean } {
    if (!orderBy) return { sort: {}, sortExternal: {}, hasExternal: false };

    const sortObj = {};
    const sortExternal = {};
    let hasExternal = false;
    const orderKeys = orderBy.split(',');
    orderKeys.forEach((key) => {
      const isFieldOrder = this.fieldSchemaDb.filter(
        (field) => field.key === key.trim() && field.orderBy,
      );
      if (!isFieldOrder.length)
        this.errorService.throwError(ErrorKeys.INVALID_DATA, {
          key: 'order field',
          value: key.trim(),
        });

      if (isFieldOrder[0].type === 'externalId') {
        hasExternal = true;
        sortExternal[key.trim()] = orderMode;
        return;
      }

      sortObj[key.trim()] = orderMode;
      sortExternal[key.trim()] = orderMode;
    });

    delete item['orderBy'];
    delete item['orderMode'];

    this.logger.log(`Sorting ${JSON.stringify(sortObj)}...`);
    return { sort: sortObj, sortExternal, hasExternal };
  }

  async joinParentSearch(searchParams: SearchParams): Promise<SearchParams> {
    for await (const field of this.fieldSchemaDb.filter(
      (field) => field.externalRelation,
    )) {
      const relation = field.externalRelation.service;
      const keys = Object.keys(searchParams).filter((key) =>
        key.startsWith(`$parent.${relation}`),
      );

      if (!keys.length) continue;

      const relationWhere = {};

      for await (const key of keys) {
        const splitKey = key.split('.');
        this.logger.log(`Relation: ${splitKey[1]} && Key: ${splitKey[2]}`);
        relationWhere[splitKey[2]] = searchParams[key];
        delete searchParams[key];
      }

      const parentItems = await this[
        `get${relation.capitalizeFirstLetter()}Service`
      ].search(
        {
          ...relationWhere,
          select: 'name',
        },
        false,
        false,
      );
      searchParams[field.key] = {
        $in: parentItems.items.map((item) => item._id),
      };
    }

    this.validateSearchRelation(searchParams, 'parent');

    return searchParams;
  }

  async joinChildrenSearch(searchParams: SearchParams): Promise<SearchParams> {
    for await (const sub of this.entitySchema.subRelations) {
      const relation = sub.service;
      const keys = Object.keys(searchParams).filter((key) =>
        key.startsWith(`$children.${relation}`),
      );

      if (!keys.length) continue;

      const relationWhere = {};

      for await (const key of keys) {
        const splitKey = key.split('.');
        this.logger.log(`Relation: ${splitKey[1]} && Key: ${splitKey[2]}`);
        relationWhere[splitKey[2]] = searchParams[key];
        delete searchParams[key];
      }

      this.logger.log(`get${relation.capitalizeFirstLetter()}Service`);

      const parentItems = await this[
        `get${relation.capitalizeFirstLetter()}Service`
      ].search(
        {
          ...relationWhere,
          select: 'name',
        },
        false,
        false,
      );

      this.logger.log(`Itens: ${JSON.stringify(parentItems.items)}`);

      if (!parentItems.items.length)
        this.errorService.throwError(ErrorKeys.NOT_FOUND);

      const relatedIds = parentItems.items.map((item) => item._id).join(',');
      searchParams['_ids'] = searchParams['_ids']
        ? `${searchParams['_ids']},${relatedIds}`
        : relatedIds;
    }
    this.validateSearchRelation(searchParams, 'children');

    return searchParams;
  }

  private validateSearchRelation(
    searchParams: SearchParams,
    familyKey: string,
  ): void {
    const pattern = `^\$${familyKey}\.\w+\.\w+$`;
    const regexFamily = new RegExp(pattern);

    Object.keys(searchParams).forEach((key) => {
      if (regexFamily.test(key))
        this.errorService.throwError(ErrorKeys.INVALID_DATA, {
          key: 'Relation',
          value: key.split('.')[1],
        });
    });
  }

  protected async validateLoggedUserByCount(
    count: number,
    searchWhere: Partial<SearchParams>,
  ) {
    if (!this.entitySchema.userKey) return;

    const itemsUser = await this.repository.count({
      ...searchWhere,
      [this.entitySchema.userKey]: await this.getLocalUserId(),
    });

    if (itemsUser !== count)
      await this.errorService.throwError(ErrorKeys.OPERATE_OTHERS_USERS, {
        key: this.entity,
      });
  }
}
