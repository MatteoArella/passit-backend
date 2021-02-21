interface Insertion {
  id: string;
  subject: string;
  title: string;
  description: string;
  tutorId: string;
  createdAt: string;
  updatedAt?: string;

  [key: string]: string | undefined;
};

export { Insertion };
