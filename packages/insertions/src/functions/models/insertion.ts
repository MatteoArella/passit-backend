import { Location } from './location';

export enum InsertionStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED'
};

export interface Insertion {
  id: string;
  subject: string;
  title: string;
  description: string;
  location: Location;
  tutorId: string;
  status: InsertionStatus;
  createdAt: string;
  updatedAt?: string;

  [key: string]: string | Location | undefined;
};

export { Location };