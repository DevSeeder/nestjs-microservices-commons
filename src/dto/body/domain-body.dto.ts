import { AbstractBodyDto } from './abtract-body.dto';

export interface DomainBodyDto extends AbstractBodyDto {
  name: string;
  key: string;
}
