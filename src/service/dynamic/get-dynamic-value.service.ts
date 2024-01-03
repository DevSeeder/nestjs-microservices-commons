import { GetTranslationService } from '@devseeder/nestjs-microservices-schemas';
import { DynamicValuesEnum } from '../../enum/dynamic-values.enum';

import { DateHelper } from '../../helper';

export class DynamicValueService {
  constructor(protected readonly translationService: GetTranslationService) {}

  static getDynamicValue(
    dynamicValue: DynamicValuesEnum,
    value: any,
    item: object = {},
  ): any {
    if (typeof dynamicValue !== 'string') return value;

    if (value.startsWith('$')) return item[value.replace('$', '')];

    switch (dynamicValue) {
      case DynamicValuesEnum.CUR_DATETIME:
        return DateHelper.getDateNow();
      case DynamicValuesEnum.CUR_DATE:
        return DateHelper.formatDate(DateHelper.getDateNow(), 'YYYY-MM-DD');
      case DynamicValuesEnum.CUR_TIME:
        return DateHelper.formatDate(DateHelper.getDateNow(), 'HH:mm:ss');
      case DynamicValuesEnum.CUR_USER:
        return 1;
      default:
        return DynamicValueService.testRegexDynamicValues(value);
    }
  }

  static testRegexDynamicValues(value: any): any {
    if (DynamicValueService.testRegex(DynamicValuesEnum.REGEX_CALCULATE, value))
      return 0;
    return value;
  }

  static testRegex(dynamicValue: DynamicValuesEnum, value: any): boolean {
    const regex = new RegExp(dynamicValue);
    return regex.test(value);
  }

  getValueMessage(dynamicValue: DynamicValuesEnum, value: any): any {
    if (typeof dynamicValue !== 'string') return value;

    if (value.startsWith('$')) return value.replace('$', '');

    switch (dynamicValue) {
      case DynamicValuesEnum.CUR_DATETIME:
      case DynamicValuesEnum.CUR_DATE:
      case DynamicValuesEnum.CUR_TIME:
      case DynamicValuesEnum.CUR_USER:
        return this.translationService.getServiceKeyTranslation(dynamicValue);
      default:
        return value;
    }
  }
}
