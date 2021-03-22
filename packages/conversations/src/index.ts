import * as cdk from '@aws-cdk/core';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as appsync from '@aws-cdk/aws-appsync';
import * as dotenv from 'dotenv';
import * as core from '@passit/core-infra';
import { join } from 'path';

dotenv.config();

export class ConversationsStack extends cdk.NestedStack {
  public readonly api: appsync.GraphqlApi;

  constructor(scope: cdk.Construct, id: string, props?: cdk.NestedStackProps) {
    super(scope, id, props);

    const api = new core.GraphqlApi(this, 'ConversationsGraphApi', {
      name: 'ConversationsGraphApi',
      schema: appsync.Schema.fromAsset(join(__dirname, 'assets/schema.graphql')),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.IAM
        }
      },
      xrayEnabled: true,
      logConfig: {
        excludeVerboseContent: false,
        fieldLogLevel: appsync.FieldLogLevel.ALL
      }
    });
    this.api = api;

    const conversationsTable = new core.Table(this, 'ConversationsTable', {
      tableName: 'conversations',
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PROVISIONED
    });

    const messagesTable = new core.Table(this, 'MessagesTable', {
      tableName: 'messages',
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PROVISIONED
    });
    messagesTable.addGlobalSecondaryIndex({
      indexName: 'conversation-index',
      partitionKey: {
        name: 'conversationId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING
      }
    });

    const convLinkTable = new core.Table(this, 'ConvLinksTable', {
      tableName: 'conv-links',
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PROVISIONED
    });
    convLinkTable.addGlobalSecondaryIndex({
      indexName: 'user-index',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING
      }
    });
    convLinkTable.addGlobalSecondaryIndex({
      indexName: 'conversation-index',
      partitionKey: {
        name: 'conversationId',
        type: dynamodb.AttributeType.STRING
      }
    });

    // create conversation lambda
    const createConversationLambda = new core.Function(this, 'CreateConversationLambda', {
      entry: join(__dirname, 'functions/createConversation.ts'),
      handler: 'handler',
      environment: {
        'CONVERSATIONS_TABLE_NAME': conversationsTable.tableName,
        'CONV_LINKS_TABLE_NAME': convLinkTable.tableName
      }
    });
    conversationsTable.grantWriteData(createConversationLambda);
    convLinkTable.grantReadWriteData(createConversationLambda);

    // get user conversations lambda
    const getUserConversationsLambda = new core.Function(this, 'GetUserConversationsLambda', {
      entry: join(__dirname, 'functions/getUserConversations.ts'),
      handler: 'handler',
      environment: {
        'CONV_LINKS_TABLE_NAME': convLinkTable.tableName
      }
    });
    convLinkTable.grantReadData(getUserConversationsLambda);

    // get conversation messages lambda
    const getConversationMessages = new core.Function(this, 'GetConversationMessagesLambda', {
      entry: join(__dirname, 'functions/getConversationMessages.ts'),
      handler: 'handler',
      environment: {
        'MESSAGES_TABLE_NAME': messagesTable.tableName
      }
    });
    messagesTable.grantReadData(getConversationMessages);

    const createConversationDs = api.addLambdaDataSource('CreateConversationLambdaResolver', createConversationLambda);
    const getUserConversationsDs = api.addLambdaDataSource('GetUserConversationsLambdaResolver', getUserConversationsLambda);
    const getConversationMessagesDs = api.addLambdaDataSource('GetConversationMessagesLambdaResolver', getConversationMessages);
    const conversationsDs = api.addDynamoDbDataSource('ConversationsDataSource', conversationsTable);
    const convLinksDs = api.addDynamoDbDataSource('ConvLinksDataSource', convLinkTable);
    const messagesDs = api.addDynamoDbDataSource('MessagesDataSource', messagesTable);

    createConversationDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'createConversation',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/Mutation.createConversation.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/Mutation.createConversation.res.vtl'))
    });

    messagesDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'createMessage',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/Mutation.createMessage.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/Mutation.createMessage.res.vtl'))
    });

    conversationsDs.createResolver({
      typeName: 'Query',
      fieldName: 'getConversation',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/Query.getConversation.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/Query.getConversation.res.vtl'))
    });

    getUserConversationsDs.createResolver({
      typeName: 'Query',
      fieldName: 'getConversations',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/Query.getConversations.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/Query.getConversations.res.vtl'))
    });

    convLinksDs.createResolver({
      typeName: 'Query',
      fieldName: 'getConvLinks',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/Query.getConvLinks.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/Query.getConvLinks.res.vtl'))
    });

    getConversationMessagesDs.createResolver({
      typeName: 'Query',
      fieldName: 'getMessages',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/Query.getMessages.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/Query.getMessages.res.vtl'))
    });
  }
}
