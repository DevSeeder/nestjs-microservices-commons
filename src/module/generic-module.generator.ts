import { DynamicModule } from '@nestjs/common';
import { ModelEntityTokens } from '../injector';
import { GenericModule } from './generic.module';
import { ModuleRef } from '@nestjs/core';

export interface GeneratorModuleOptions {
  authGuard;
  interceptor;
  configuration;
  modelTokens: ModelEntityTokens;
  moduleRef: ModuleRef;
}

export class GenericModuleGenerator {
  static generateModules(
    moduleOptions: GeneratorModuleOptions,
  ): DynamicModule[] {
    const modules = [];
    const moduleKeys = Object.keys(moduleOptions.modelTokens);
    moduleKeys.forEach((key) => {
      const entityToken = moduleOptions.modelTokens[key];
      modules.push(
        GenericModule.forFeature({
          ...moduleOptions,
          entity: entityToken['collection'],
          modelName: entityToken['modelName'],
          customProvider: entityToken['customProvider'],
        }),
      );
    });
    return modules;
  }
}
