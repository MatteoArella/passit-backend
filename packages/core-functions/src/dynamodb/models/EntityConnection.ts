interface EntityConnection<T> {
  items: T[];
  after?: string;
};

export { EntityConnection };
