import { Location } from './location';

export interface Insertion {
  id: string;
  subject: string;
  title: string;
  description: string;
  location: Location;
  tutorId: string;
  createdAt: string;
  updatedAt?: string;

  [key: string]: string | Location | undefined;
};
