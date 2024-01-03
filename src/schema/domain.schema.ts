/* eslint-disable @typescript-eslint/no-unused-vars */
import { Prop } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { AbstractSchema } from './abstract.schema';

export type DomainDocument = AbstractDomain & Document;

export abstract class AbstractDomain extends AbstractSchema {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  key: string;

  @Prop({ required: false, default: [] })
  translations?: Translation[];
}

export interface Translation {
  locale: string;
  value: string;
}
