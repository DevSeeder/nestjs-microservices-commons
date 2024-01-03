import { ObjectId } from 'mongoose';

export interface CloneOneResponse {
  _id: ObjectId;
}

export interface CloneManyResponse {
  _ids: ObjectId[];
}
