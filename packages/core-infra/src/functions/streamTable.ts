import AWS from 'aws-sdk';
import { DynamoDBStreamHandler } from 'aws-lambda';
import { Client } from '@elastic/elasticsearch';
import createAwsElasticsearchConnector from 'aws-elasticsearch-connector';

export const handler: DynamoDBStreamHandler = async (event) => {
  const domain = process.env.ES_DOMAIN!;
  const index = process.env.ES_INDEX!;
  if (!event.Records) {
    return;
  }

  const client = new Client({
    ...createAwsElasticsearchConnector(AWS.config),
    node: `https://${domain}`
  });

  for (const record of event.Records.filter((_) => _.dynamodb)) {
    try {
      const keys = record.dynamodb!.Keys;
      const id = keys?.[process.env.PK!].S;

      if (!id) {
        continue;
      }
      if (record.eventName === 'REMOVE') {
        await client.delete({ index, id });
      } else {
        if (!record.dynamodb!.NewImage) {
          continue;
        }
        const convertedDocument = AWS.DynamoDB.Converter.output({ 'M': record.dynamodb!.NewImage });
        await client.index({ index, id, body: convertedDocument });
      }
    } catch (err) {
      console.error(record);
      console.error(err);
    }
  };
};
