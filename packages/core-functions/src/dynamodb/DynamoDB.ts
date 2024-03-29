import { DynamoDB as Dynamo, Request, AWSError } from 'aws-sdk';
import { EntityConnection } from './models/EntityConnection';

type QueryParamsInput = Dynamo.DocumentClient.QueryInput | Dynamo.DocumentClient.ScanInput;
type QueryParamsOutput = Dynamo.DocumentClient.QueryOutput | Dynamo.DocumentClient.ScanOutput;

interface Query {
  (params: QueryParamsInput): Request<QueryParamsOutput, AWSError>;
}

export class DynamoDB<T> extends Dynamo.DocumentClient {
  constructor(options?: Dynamo.Types.ClientConfiguration | undefined) {
    super({ apiVersion: '2012-08-10', ...options });
  }

  async getData(params: QueryParamsInput): Promise<EntityConnection<T>> {
    var after = params.ExclusiveStartKey;
    var limit = params.Limit;
    const entityConnection: EntityConnection<T> = {
      items: []
    };
    var query: Query;
    if ((params as Dynamo.DocumentClient.QueryInput).KeyConditionExpression) {
      query = this.query.bind(this);
    } else {
      query = this.scan.bind(this);
    }
    do {
      const { Items: items, LastEvaluatedKey: nextToken } = await query({
        ...params,
        Limit: limit,
        ExclusiveStartKey: after
      }).promise();
      entityConnection.items.push(...items as T[]);
      after = nextToken;
      entityConnection.after = after ? after['id'] : undefined;
      if (limit) {
        if (entityConnection.items.length >= limit) {
          return entityConnection;
        }
        limit -= entityConnection.items.length;
      }
      if (!after) {
        return entityConnection;
      }
    } while (true)
  }
}
