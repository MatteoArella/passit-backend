export interface Message {
  id: string;
  content: string;
  authorId: string;
  to: string;
  conversationId: string;
  createdAt: string;
  updatedAt?: string;
};
