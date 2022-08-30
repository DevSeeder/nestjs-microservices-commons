import { EmptyPropException } from '@devseeder/microservices-exceptions';

export abstract class DTO {
  static validateIsAnyEmptyKey(context: Object) {
    Object.keys(context).forEach(function (key) {
      if (context[key].length === 0) throw new EmptyPropException(key);
    });
  }
}
