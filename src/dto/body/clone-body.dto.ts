import { AbstractBodyDto } from './abtract-body.dto';

export interface ClonyOneBodyDto {
  cloneRelations?: string[];
  replaceBody?: AbstractBodyDto;
}

export interface ClonyManyBodyDto extends ClonyOneBodyDto {
  _ids: string[];
}
