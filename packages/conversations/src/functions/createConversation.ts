import { Handler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import { Conversation } from './models/conversation';
import { ConvLink } from './models/convLink';

type FunctionParams = {
  userId: string;
  tutorId: string;
};

const ddb = new DynamoDB.DocumentClient();

const indexConversationMembers = (...members: string[]): string => {
  return members.join('#');
};

export const handler: Handler<FunctionParams, ConvLink> = async (event) => {
  const datetime = moment().toISOString();
  const conversation: Conversation = {
    id: uuidv4(),
    createdAt: datetime,
    updatedAt: datetime
  };
  const convLinkUser: ConvLink = {
    id: uuidv4(),
    userId: event.userId,
    conversationId: conversation.id,
    createdAt: datetime,
    updatedAt: datetime
  };
  const convLinkTutor: ConvLink = {
    id: uuidv4(),
    userId: event.tutorId,
    conversationId: conversation.id,
    createdAt: datetime,
    updatedAt: datetime
  };
  // simulate unique constraints on conversation between user and tutor
  // according to https://aws.amazon.com/it/blogs/database/simulating-amazon-dynamodb-unique-constraints-using-transactions
  try {
    await ddb.transactWrite({
      TransactItems: [
        {
          Put: {
            TableName: process.env.CONV_LINKS_TABLE_NAME!,
            Item: { id: indexConversationMembers(event.userId, event.tutorId), conversationId: `#${conversation.id}` },
            ConditionExpression: 'attribute_not_exists(id)'
          }
        },
        {
          Put: {
            TableName: process.env.CONV_LINKS_TABLE_NAME!,
            Item: { id: indexConversationMembers(event.tutorId, event.userId), conversationId: `#${conversation.id}` },
            ConditionExpression: 'attribute_not_exists(id)'
          }
        },
        {
          Put: {
            TableName: process.env.CONV_LINKS_TABLE_NAME!,
            Item: convLinkUser,
            ConditionExpression: 'attribute_not_exists(id)'
          }
        },
        {
          Put: {
            TableName: process.env.CONV_LINKS_TABLE_NAME!,
            Item: convLinkTutor,
            ConditionExpression: 'attribute_not_exists(id)'
          }
        },
        {
          Put: {
            TableName: process.env.CONVERSATIONS_TABLE_NAME!,
            Item: conversation,
            ConditionExpression: 'attribute_not_exists(id)'
          }
        }
      ]
    }).promise();
    return convLinkTutor;
  } catch (err) {
    // a conversation between the two users already exists, so return it
    const { Item: existingConvLinkIndexing } = await ddb.get({
      TableName: process.env.CONV_LINKS_TABLE_NAME!,
      Key: {
        id: indexConversationMembers(event.tutorId, event.userId)
      }
    }).promise();
    const conversationId = (existingConvLinkIndexing as ConvLink).conversationId.substring(1);
    const { Items: existingConvLinkTutor } = await ddb.query({
      TableName: process.env.CONV_LINKS_TABLE_NAME!,
      IndexName: 'conversation-index',
      KeyConditionExpression: 'conversationId = :conversationId',
      FilterExpression: 'userId = :tutorId',
      ExpressionAttributeValues: {
        ':conversationId': conversationId,
        ':tutorId': event.tutorId
      }
    }).promise();
    return existingConvLinkTutor?.pop() as ConvLink;
  }
};
