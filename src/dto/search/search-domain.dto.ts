import { Search } from '../search.dto';

export class SearchDomainDto extends Search {
  name?: string;
  key?: string;
}
