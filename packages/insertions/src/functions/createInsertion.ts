import { DynamoDB } from 'aws-sdk';
import { APIGatewayProxyHandler } from 'aws-lambda';
import { HttpResponse, HttpErrorResponse } from '@passit/core-functions';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import { Insertion } from './models/insertion';

type FunctionParams = {
  title: string;
  description: string;
  subject: string;
  tutorId: string;
};

const ddb = new DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });

export const handler: APIGatewayProxyHandler = async (event) => {
  const res = new HttpResponse<Insertion | HttpErrorResponse>();
  if (!event.body) {
    return res.status(400).json({ message: 'bad request' });
  }

  const params = JSON.parse(event.body) as FunctionParams;
  const datetime = moment().toISOString();
  const insertion: Insertion = {
    id: uuidv4(),
    createdAt: datetime,
    updatedAt: datetime,
    ...params
  };

  try {
    await ddb.put({
      TableName: process.env.INSERTIONS_TABLE_NAME!,
      Item: insertion
    }).promise();
    return res.status(201).json(insertion);
  } catch (err) {
    return res.status(500).json({ message: JSON.stringify(err) });
  }
};
