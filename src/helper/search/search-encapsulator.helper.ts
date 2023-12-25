import { MAX_ENCAPSULATED_OPERATORS } from '../../app.constants';

export class SearchEncapsulatorHelper {
  static cleanToValidateSchema(obj: object): Array<object> {
    const cleanArray = [];
    const notEncapObj = {};
    const objIndex = [];

    const regex = /^(and|or)\d+_/;
    Object.keys(obj).forEach((key) => {
      if (!regex.test(key)) {
        notEncapObj[key] = obj[key];
        return;
      }

      for (let i = 1; i <= MAX_ENCAPSULATED_OPERATORS; i++) {
        const regex = new RegExp(`^(and|or)${i}_`);
        if (regex.test(key)) {
          const cleanKey = key.replace(`and${i}_`, '').replace(`or${i}_`, '');
          if (!objIndex[i]) objIndex[i] = {};
          objIndex[i][cleanKey] = obj[key];
        }
      }
    });

    if (Object.keys(objIndex).length)
      cleanArray.push(...objIndex.filter((i) => i));
    if (Object.keys(notEncapObj).length) cleanArray.push(notEncapObj);

    return cleanArray;
  }

  static buildEncapsulatedSearch(obj: object): object {
    const notEncapObj = {};
    const objIndex = { $and: [], $or: [] };

    const regex = /^(and|or)\d+_/;
    Object.keys(obj).forEach((key) => {
      if (!regex.test(key)) {
        notEncapObj[key] = obj[key];
        return;
      }

      for (let i = 1; i <= MAX_ENCAPSULATED_OPERATORS; i++) {
        const regex = new RegExp(`^(and|or)${i}_`);
        if (regex.test(key)) {
          const cleanKey = key.replace(`and${i}_`, '').replace(`or${i}_`, '');
          const encapKey = `$${key
            .replace(`_${cleanKey}`, '')
            .replace(/\d+/g, '')}`;
          if (!objIndex[encapKey][i]) objIndex[encapKey][i] = {};
          objIndex[encapKey][i][cleanKey] = obj[key];
        }
      }
    });

    if (!objIndex.$and.length) delete objIndex.$and;
    if (!objIndex.$or.length) delete objIndex.$or;

    return {
      ...{
        ...objIndex,
        $or: objIndex.$or ? objIndex.$or.filter((o) => o) : [],
        $and: objIndex.$and ? objIndex.$and.filter((o) => o) : []
      },
      ...notEncapObj
    };
  }
}
