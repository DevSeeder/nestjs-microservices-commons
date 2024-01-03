import { Search } from '../../../../pet-helper-api/src/microservice/application/dto/search/search.dto';

export class SearchDomainDto extends Search {
  name?: string;
  key?: string;
}
