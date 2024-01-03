import { getModelToken } from '@nestjs/mongoose';
import { Schema } from 'mongoose';

export interface ModelEntityTokens {
  [key: string]: {
    modelName: string;
    schema: Schema;
    collection: string;
  };
}

export class EntityModelTokenBuilder {
  static buildMongooseStaticModelForFeature(modelTokens: ModelEntityTokens) {
    const arrModel = [];
    Object.keys(modelTokens).forEach((key) => {
      arrModel.push({
        name: modelTokens[key].modelName,
        schema: modelTokens[key].schema,
      });
    });
    return arrModel;
  }

  // static buildMongooseModelTokens() {
  //   return Object.keys(ModelEntityTokens).map((key) =>
  //     getModelToken(ModelEntityTokens[key].modelName),
  //   );
  // }

  // static async buildMongooseModelInjector(
  //   moduleRef: ModuleRef,
  // ): Promise<{ [key: string]: Model<any> }> {
  //   const modelsMap = {};
  //   for await (const key of Object.keys(ModelEntityTokens)) {
  //     const modelName: string = ModelEntityTokens[key].modelName;
  //     const modelNameKey = ModelEntityTokens[key].collection;
  //     modelsMap[modelNameKey] = await moduleRef.get(getModelToken(modelName), {
  //       strict: false,
  //     });
  //   }
  //   return modelsMap;
  // }
}
