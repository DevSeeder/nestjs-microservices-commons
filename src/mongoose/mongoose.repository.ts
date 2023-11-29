import { Logger } from '@nestjs/common';
import { HydratedDocument, Model, ObjectId } from 'mongoose';
import { MongoError } from 'mongodb';
import { MongooseHelper } from './mongoose.helper';
import { getModelToken } from '@nestjs/mongoose';
import { MongoDBException } from '@devseeder/microservices-exceptions';

export type MongooseDocument = HydratedDocument<any>;

export type MongooseDocumentID = string | ObjectId;

export abstract class MongooseRepository<Collection, MongooseModel> {
  protected readonly logger: Logger = new Logger(this.constructor.name);

  constructor(protected model: Model<MongooseModel>) {}

  async insertOne(item: Collection, name: string): Promise<ObjectId> {
    return this.create(item).then(
      (savedDoc: MongooseDocument) => {
        this.logger.log(
          `${item.constructor.name} '${name}' saved successfully!`,
        );
        this.logger.log(`ID: ${savedDoc._id}`);
        return savedDoc._id;
      },
      (err: MongoError) => {
        this.logger.error(err.message);
        throw new MongoDBException(err.message, err.code);
      },
    );
  }

  async create(document: Collection): Promise<MongooseDocument> {
    return new Promise(async (resolve, reject) => {
      this.model.create(document, function (err, savedDoc) {
        if (err) reject(err);
        resolve(savedDoc);
      });
    });
  }

  async groupBy(group, match = {}, select = {}): Promise<any[]> {
    const aggregateParams = [];

    if (Object.keys(match).length > 0) aggregateParams.push({ $match: match });

    aggregateParams.push({
      $group: {
        _id: group,
        count: { $sum: 1 },
        ...MongooseHelper.buildSelectAggregated(select),
      },
    });
    return this.model.aggregate(aggregateParams);
  }

  async aggregate(
    group: any,
    match = {},
    select = {},
    unwind = '',
  ): Promise<any[]> {
    const aggregateParams = [];

    if (Object.keys(match).length > 0) aggregateParams.push({ $match: match });

    if (unwind.length > 0) aggregateParams.push({ $unwind: `\$${unwind}` });

    aggregateParams.push({
      $group: {
        ...group,
        count: { $sum: 1 },
        ...select,
      },
    });
    return this.model.aggregate(aggregateParams);
  }

  /* istanbul ignore next */
  async aggregateNotExists(
    from: string,
    joinFrom: string,
    joinLet: string,
    match: any = {},
  ): Promise<any[]> {
    const aggregateParams = [];

    aggregateParams.push(
      MongooseHelper.buildLookupAggregate(from, joinFrom, joinLet, match),
    );

    const matchParam = {};
    matchParam[`aggElement.${joinFrom}`] = { $exists: false };

    if (Object.keys(match).length > 0)
      aggregateParams.push({ $match: { ...matchParam, ...match } });

    aggregateParams.push({
      $project: {
        likes: false,
      },
    });
    return this.model.aggregate(aggregateParams);
  }

  async findAll(select: object = {}): Promise<any[]> {
    if (Object.keys(select).length === 0) select = { _id: 0 };
    return this.model.find({}).select(select).lean().exec();
  }

  async findById(
    id: MongooseDocumentID,
    select: object = {},
  ): Promise<MongooseDocument> {
    if (Object.keys(select).length === 0) select = { _id: 0 };
    return this.model.findById(id).select(select).lean().exec();
  }

  async updateOneById(id: MongooseDocumentID, data: any): Promise<void> {
    const res = await this.updateOne({ _id: id }, data);
    this.logger.log(
      `${getModelToken(this.model.name)} ${id} - Succesfully updated!.`,
    );
    return res;
  }

  async updateOne(
    query: any,
    data: any,
    pushData = {},
    strict = false,
  ): Promise<void> {
    this.model.findOneAndUpdate(
      query,
      { $set: data, ...pushData },
      { upsert: false, strict },
      function (err: MongoError) {
        if (err) throw new MongoDBException(err.message, err.code);
      },
    );
  }

  async updateMany(
    query: any,
    data: any,
    pushData = {},
    strict = true,
  ): Promise<void> {
    this.model.updateMany(
      query,
      { $set: data, ...pushData },
      { upsert: false, strict },
      function (err: MongoError) {
        if (err) throw new MongoDBException(err.message, err.code);
      },
    );
  }

  async deleteOneById(id: string | number): Promise<void> {
    await this.model.deleteOne({ id });
  }

  async find(
    searchParams: any,
    select: any = {},
    sort: any = {},
    regex = true,
    limit = 0,
    skip = 0,
  ): Promise<any[]> {
    if (Object.keys(select).length === 0) select = { _id: 0 };

    searchParams = regex
      ? MongooseHelper.buildRegexFilterQuery(searchParams)
      : searchParams;

    let res = this.model.find(searchParams);

    if (skip) res = res.skip(skip - 1);
    if (limit) res = res.limit(limit);

    if (typeof sort === 'object' && Object.keys(sort).length > 0)
      res = res.sort(sort);

    if (typeof sort === 'object' && Object.keys(sort).length > 0)
      res = res.sort(sort);

    return res.select(select).lean().exec();
  }
}
