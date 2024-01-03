import { Injectable } from '@nestjs/common';
import { Document, Model } from 'mongoose';
import { MongooseRepository } from './mongoose.repository';
import { Search } from '../dto';
import { AggregatedDto } from '../dto/aggregate/aggregated.dto';

@Injectable()
export class GenericRepository<Collection> extends MongooseRepository<
  Collection,
  Collection & Document
> {
  constructor(model: Model<Collection & Document>) {
    super(model);
  }

  getIndexes(): object {
    return this.model.collection.getIndexes() as unknown as object;
  }

  async count(searchParams: object): Promise<number> {
    return this.model.countDocuments(searchParams);
  }

  async groupBy(
    searchParams: Search,
    entityRel: string,
    fkField: string,
    sumField = '',
    array = false,
  ): Promise<AggregatedDto[]> {
    const aggGroup = { count: { $sum: 1 } };
    if (sumField) {
      aggGroup[`total${sumField.capitalizeFirstLetter()}`] = {
        $sum: `$${sumField}`,
      };
      aggGroup[`avg${sumField.capitalizeFirstLetter()}`] = {
        $avg: `$${sumField}`,
      };
    }

    const aggParam = [
      {
        $match: searchParams,
      },
      ...this.returnLookupGroupBy(entityRel, fkField, array),
      {
        $group: {
          _id: `$${entityRel}Objects._id`,
          name: { $first: `$${entityRel}Objects.name` },
          ...aggGroup,
        },
      },
    ];

    this.logger.log(`Aggregate: ${JSON.stringify(aggParam)}`);

    return this.model.aggregate(aggParam);
  }

  private returnLookupGroupBy(
    entityRel: string,
    fkField: string,
    array = false,
  ): any {
    if (array)
      return [
        {
          $unwind: `$${entityRel}`,
        },
        {
          $lookup: {
            from: entityRel,
            let: { pids: { $split: [`$${fkField}`, ','] } },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: [
                      { $toObjectId: '$_id' },
                      {
                        $map: {
                          input: '$$pids',
                          as: 'pid',
                          in: { $toObjectId: '$$pid' },
                        },
                      },
                    ],
                  },
                },
              },
            ],
            as: `${entityRel}Objects`,
          },
        },
      ];

    return [
      {
        $lookup: {
          from: entityRel,
          let: { stringValue: { $toObjectId: `$${fkField}` } },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$stringValue'] }, // Compara o campo _id com a stringField
              },
            },
          ],
          as: `${entityRel}Objects`,
        },
      },
    ];
  }
}
