import { DBReference } from 'src/interface/db-reference.interface';

export abstract class AbstractTransformation<ItemReference> {
  abstract dbRefs: DBReference[];
  convertReferenceDB(input: ItemReference): ItemReference {
    const searchDB = { ...input };
    this.dbRefs.forEach((item) => {
      searchDB[item.dbKey] = searchDB[item.searchKey];
      delete searchDB[item.searchKey];
    });
    return searchDB;
  }
}
