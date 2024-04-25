import { Inject, Injectable, Scope } from '@nestjs/common';
import { FieldSchemaBuilder } from '../../helper/validator/field-schema.builder';
import { SortHelper } from '../../helper/search/sort.helper';
import {
  CountResponse,
  PaginatedMeta,
  PaginatedResponse,
} from '../../dto/response/paginated.response';
import { CustomErrorException } from '@devseeder/microservices-exceptions';
import { GroupByResponse } from '../../dto/response/groupby/group-by.response';
import { AbstractSearchService } from './abstract-search.service';
import {
  ErrorService,
  GetTranslationService,
} from '@devseeder/nestjs-microservices-schemas';
import { REQUEST } from '@nestjs/core';
import {
  EntitySchema,
  FieldSchema,
} from '@devseeder/nestjs-microservices-schemas';
import { Search } from '../../dto';
import { ErrorKeys } from '../../enum/error-keys.enum';
import {
  FieldSchemaPage,
  FormSchemaResponse,
} from '../../interface/field-schema.interface';
import { GenericRepository } from '../../mongoose/generic.repository';
import { DependencyInjectorToken } from '../../app.constants';

@Injectable({ scope: Scope.REQUEST })
export class GenericGetService<
  Collection,
  ResponseModel,
  SearchParams extends Search,
> extends AbstractSearchService<
  Collection,
  Collection & Document,
  ResponseModel,
  Search
> {
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

  async search(
    searchParams: SearchParams = null,
    paginate = true,
    convertOutput = true,
  ): Promise<PaginatedResponse<ResponseModel>> {
    let searchWhere;

    try {
      this.logger.log(`Build Search Params: ${JSON.stringify(searchParams)}`);
      searchWhere = await this.buildSearchParams(searchParams);
    } catch (err) {
      if (err instanceof CustomErrorException)
        if (err.errCode === 404) return { items: [] };
      throw err;
    }

    const { page, pageSize } = this.getPagination(searchParams, searchWhere);
    const { sort, sortExternal, hasExternal } = this.validateOrderField(
      searchWhere,
      searchParams?.orderBy,
      searchParams?.orderMode | 1,
    );

    this.logger.log(
      `Searching '${this.entitySchema.itemLabel}' ${JSON.stringify(
        searchWhere,
      )}...`,
    );
    const responseItems = await this.repository.find(
      searchWhere,
      this.getSelectFields(searchParams),
      sort,
      false,
      pageSize,
      page,
    );

    this.logger.log(`Items found: ${responseItems.length}.`);

    await this.validateOnlyLoggedUserForItems(responseItems);

    const arrMap = await responseItems.map(
      async (item) => await this.convertRelation(item),
    );

    const totalSorted = SortHelper.orderBy<ResponseModel>(
      convertOutput ? await Promise.all(arrMap) : responseItems,
      this.fieldSchemaDb,
      sortExternal,
      hasExternal,
    );

    const response = {
      items: totalSorted,
    };
    if (paginate)
      response['meta'] = await this.getPaginatedResponse(
        totalSorted,
        searchWhere,
        searchParams.page,
        pageSize,
      );
    return response;
  }

  async getById(id: string, validateError = false): Promise<ResponseModel> {
    let item;
    try {
      this.logger.log(`Get ${this.entitySchema.entity} By Id ${id}`);
      item = await this.repository.findById(id, { all: 0 });

      if (!item && validateError) {
        const entityTranslation =
          await this.translationService.getEntityTranslation(
            this.entitySchema.entity,
          );
        this.errorService.throwError(ErrorKeys.NOT_FOUND, {
          key: entityTranslation.itemLabel,
        });
      }
    } catch (err) {
      this.errorService.throwError(ErrorKeys.INVALID_DATA, {
        key: 'Id',
        value: id,
      });
    }

    await this.validateOnlyLoggedUserForItems([item]);

    return this.convertRelation(item);
  }

  async getForm(): Promise<FormSchemaResponse> {
    const fields = this.fieldSchemaDb;
    const orderFields = this.fieldSchemaDb.filter((fields) => fields.orderBy);
    const arrayResponse = [];

    for await (const field of fields) {
      const objectItem = { ...field };

      if (field.type === 'externalId' && !field.hidden) {
        const values = await this[
          `get${field.externalRelation.service.capitalizeFirstLetter()}Service`
        ].search({
          pageSize: 50,
          select: field.externalRelation['nameKey']
            ? field.externalRelation['nameKey']
            : 'name,icon',
        });
        objectItem['values'] = values.items;
      }

      objectItem['translation'] =
        await this.translationService.getFieldTranslation(
          this.entityLabels,
          field.key,
        );

      arrayResponse.push(objectItem);
    }

    const cloneRelations = this.entitySchema.subRelations.filter(
      (sub) => sub.clone,
    );

    const entityTranslation =
      await this.translationService.getEntityTranslation(
        this.entitySchema.entity,
      );

    const response: FormSchemaResponse = {
      fields: arrayResponse,
      cloneRelations: await Promise.all(
        cloneRelations.map(async (rel) => ({
          relation: rel.entity,
          label: (
            await this.translationService.getFieldTranslation(
              [rel.entity],
              rel.key,
            )
          ).fieldLabel,
        })),
      ),
      entityRefs: {
        translations: entityTranslation,
        ...this.entitySchema,
      },
    };

    response.filterOptions = {
      orderBy: await Promise.all(
        orderFields.map(async (field) => ({
          key: field.key,
          label: (
            await this.translationService.getFieldTranslation(
              this.entityLabels,
              field.key,
            )
          ).fieldLabel,
        })),
      ),
    };

    return response;
  }

  private getPagination(
    search: SearchParams = null,
    searchWhere: Partial<SearchParams>,
  ): {
    pageSize: number;
    page: number;
  } {
    if (!search) return { page: 0, pageSize: 0 };

    delete searchWhere.page;
    delete searchWhere.pageSize;

    const limit = search?.pageSize | 0;
    const curPage = search?.page <= 1 ? 0 : search?.page;

    const returnPagination = {
      pageSize: search?.pageSize | 0,
      page: limit && curPage ? (curPage - 1) * limit + 1 : 0,
    };
    this.logger.log(`Pagination ${JSON.stringify(returnPagination)}...`);
    return returnPagination;
  }

  private getSelectFields(params: Partial<SearchParams>): {
    [key: string]: number;
  } {
    if (!params.select) return { all: 0 };

    const selectParam = {};
    params.select.split(',').forEach((key) => {
      if (
        !this.fieldSchemaDb.find((schema) => schema.key === key) &&
        !['icon'].includes(key)
      )
        this.errorService.throwError(ErrorKeys.INVALID_DATA, {
          key: 'select field',
          value: key,
        });
      selectParam[key] = 1;
    });

    return { ...selectParam, _id: 1 };
  }

  private async getPaginatedResponse(
    items: ResponseModel[],
    searchWhere: object,
    page: number,
    pageSize: number,
  ): Promise<PaginatedMeta> {
    const count = await this.repository.count(searchWhere);
    const hasNextPage = (page - 1) * pageSize + items.length < count;
    const currentPage = page ? Number(page) : 1;
    return {
      currentPage,
      nextPage: hasNextPage ? currentPage + 1 : currentPage,
      hasNext: hasNextPage,
      pageRecords: items.length,
      totalRecords: count,
      actualIndex: items.length ? (page - 1) * pageSize + items.length : 0,
      numberOfPages: Math.ceil(count / pageSize),
    };
  }

  async count(searchParams: SearchParams): Promise<CountResponse> {
    const searchWhere = await this.buildSearchParams(searchParams);
    this.logger.log(
      `Counting '${this.entitySchema.itemLabel}' for: ${JSON.stringify(
        searchWhere,
      )}`,
    );
    const totalRecords = await this.repository.count(searchWhere);
    await this.validateLoggedUserByCount(totalRecords, searchWhere);
    return {
      totalRecords,
    };
  }

  async groupBy(
    groupedEntity: string,
    searchParams: SearchParams = null,
  ): Promise<GroupByResponse[]> {
    const sumField = searchParams['sumField'];
    delete searchParams['sumField'];

    const rel = this.fieldSchemaDb.filter(
      (schema) =>
        schema.externalRelation &&
        schema.externalRelation.service === groupedEntity,
    );

    const sumFieldSchema = this.fieldSchemaDb.filter(
      (schema) =>
        schema.key === sumField &&
        ['number', 'double', 'integer'].includes(schema.type),
    );
    if (sumField && !sumFieldSchema.length)
      this.errorService.throwError(ErrorKeys.INVALID_DATA, {
        key: 'Sum Field',
        value: sumField,
      });

    if (!rel.length)
      this.errorService.throwError(ErrorKeys.INVALID_DATA, {
        key: 'Relation',
        value: groupedEntity,
      });

    await this.count(searchParams);

    const searchWhere = await this.buildSearchParams(searchParams);

    const aggResponse = await this.repository.groupBy(
      searchWhere,
      rel[0].externalRelation.service,
      rel[0].key,
      sumField,
      rel[0].array,
    );

    const arrResponse: any[] = [];

    for await (const agg of aggResponse) {
      if (!agg._id || !agg._id.length) continue;

      const responseObj = {};
      responseObj[`${rel[0].key}`] = {
        id: agg._id[0],
        value: agg.name[0],
      };
      arrResponse.push({
        ...responseObj,
        groupResult: {
          totalSum: sumField
            ? agg[`total${sumField.capitalizeFirstLetter()}`]
            : undefined,
          avg: sumField
            ? agg[`avg${sumField.capitalizeFirstLetter()}`]
            : undefined,
          count: agg.count,
        },
      });
    }

    return arrResponse;
  }
}
