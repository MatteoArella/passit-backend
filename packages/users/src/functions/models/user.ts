interface User {
  id: string;
  email: string;
	familyName: string;
  givenName: string;
  phoneNumber?: string;
  birthDate?: string;
  picture?: string;
  createdAt: string;
  updatedAt?: string;
  
  [key: string]: string | undefined;
};

export { User };
