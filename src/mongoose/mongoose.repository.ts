import { Logger } from '@nestjs/common';
import { ClientSession, HydratedDocument, Model, ObjectId } from 'mongoose';
import { MongoError } from 'mongodb';
import { MongooseHelper } from './mongoose.helper';
import { getModelToken } from '@nestjs/mongoose';
import { MongoDBException } from '@devseeder/microservices-exceptions';

export type MongooseDocument = HydratedDocument<any>;

export type MongooseDocumentID = string | ObjectId;

export abstract class MongooseRepository<Collection, MongooseModel> {
  protected readonly logger: Logger = new Logger(this.constructor.name);
  protected session: ClientSession;

  constructor(protected model: Model<MongooseModel>) {}

  async insertOne(
    item: Collection,
    name: string,
    session: ClientSession = null,
  ): Promise<ObjectId> {
    return this.create(item, session).then(
      (savedDoc: MongooseDocument) => {
        this.logger.log(
          `${item.constructor.name} '${name}' saved successfully!`,
        );
        this.logger.log(`ID: ${savedDoc[0]._id}`);
        return savedDoc[0]._id;
      },
      (err: MongoError) => {
        this.logger.error(err.message);
        throw new MongoDBException(err.message, err.code);
      },
    );
  }

  async create(
    document: Collection,
    session: ClientSession = null,
  ): Promise<MongooseDocument> {
    return new Promise(async (resolve, reject) => {
      this.model.create(
        [document],
        this.getSessionOptions(session),
        function (err, savedDoc) {
          if (err) reject(err);
          resolve(savedDoc);
        },
      );
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

  async updateOneById(
    id: MongooseDocumentID,
    data: any,
    session: ClientSession = null,
    pushData = {},
    strict = false,
  ): Promise<void> {
    const res = await this.updateOne(
      { _id: id },
      data,
      pushData,
      strict,
      session,
    );
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
    session: ClientSession = null,
  ): Promise<void> {
    const options = {
      upsert: false,
      strict,
      ...this.getSessionOptions(session),
    };
    this.logger.log(`Update Options: ${options}`);
    await this.model
      .findOneAndUpdate(query, { $set: data, ...pushData }, options)
      .catch((err) => {
        console.log('Mongo Error');
        console.log(err);
        throw new MongoDBException(err.message, err.code);
      });
  }

  async updateMany(
    query: any,
    data: any,
    pushData = {},
    strict = true,
    session: ClientSession = null,
  ): Promise<any> {
    const result = this.model.updateMany(
      query,
      { $set: data, ...pushData },
      { upsert: false, strict, ...this.getSessionOptions(session) },
    );

    return result.exec((err, result) => {
      if (err) throw new MongoDBException(err.message, err.name);

      console.log(result.modifiedCount, 'records updated.');

      return result;
    });
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

  private async startSession(): Promise<void> {
    if (this.session) this.logger.warn(`Session already exists`);
    this.session = await this.model.startSession();
  }

  private async endSession(): Promise<void> {
    if (!this.session) this.logger.warn(`Session already finished`);
    await this.session.endSession();
    this.session = null;
  }

  async startTransaction(): Promise<ClientSession> {
    if (this.session) return;
    this.logger.log(`Starting transaction...`);
    await this.startSession();
    await this.session.startTransaction();
    return this.session;
  }

  async commit(): Promise<void> {
    if (!this.session) return;
    this.logger.log(`Committing transaction...`);
    await this.session.commitTransaction();
    await this.endSession();
    this.logger.log(`Transaction commited.`);
  }

  async rollback(): Promise<void> {
    if (!this.session) return;
    this.logger.log(`Starting Rollback...`);
    await this.session.abortTransaction();
    await this.endSession();
    this.logger.log(`Rollback finished.`);
  }

  private getSessionOptions(session: ClientSession = null) {
    const clientSession = session
      ? session
      : this.session
      ? this.session
      : null;
    return clientSession ? { session: clientSession } : {};
  }
}
