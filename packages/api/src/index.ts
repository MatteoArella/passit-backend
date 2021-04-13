import * as cdk from '@aws-cdk/core';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as appsync from '@aws-cdk/aws-appsync';
import * as cognito from '@aws-cdk/aws-cognito';
import * as es from '@aws-cdk/aws-elasticsearch';
import * as iam from '@aws-cdk/aws-iam';
import * as core from '@passit/core-infra';
import { join } from 'path';

export interface ApiStackProps extends cdk.NestedStackProps {
  userPool: cognito.IUserPool;
  authenticatedRole: iam.Role;
  esDomain: es.Domain;
  conversationsServiceApi: appsync.GraphqlApi;
}

export class ApiStack extends cdk.NestedStack {
  public readonly api: appsync.GraphqlApi;

  constructor(scope: cdk.Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const usersServiceRestApi = apigateway.RestApi.fromRestApiId(this, 'UsersServiceApiId', cdk.Fn.importValue('UsersServiceApiId'));
    const insertionsServiceRestApi = apigateway.RestApi.fromRestApiId(this, 'InsertionsServiceApiId', cdk.Fn.importValue('InsertionsServiceApiId'));

    const api = new core.GraphqlApi(this, 'PassItGraphApi', {
      name: 'PassItGraphApi',
      schema: appsync.Schema.fromAsset(join(__dirname, 'assets/schema.graphql')),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool: props.userPool
          }
        }
      },
      xrayEnabled: true,
      logConfig: {
        excludeVerboseContent: false,
        fieldLogLevel: appsync.FieldLogLevel.ALL
      }
    });
    this.api = api;

    // users service
    const usersServiceDs = api.addHttpDataSource('UsersServiceDataSource', `https://${usersServiceRestApi.restApiId}.execute-api.${this.region}.amazonaws.com`, {
      authorizationConfig: {
        signingRegion: this.region,
        signingServiceName: 'execute-api'
      }
    });

    iam.Role.fromRoleArn(this, 'UsersServiceDataSourceRole', usersServiceDs.ds.serviceRoleArn!)
      .attachInlinePolicy(new iam.Policy(this, 'UsersServiceDataSourcePolicy', {
        statements: [
          new iam.PolicyStatement({
            actions: [ 'execute-api:Invoke' ],
            effect: iam.Effect.ALLOW,
            resources: [ usersServiceRestApi.arnForExecuteApi() ]
          })
        ]
      }));

    // insertions service
    const insertionsServiceDs = api.addHttpDataSource('InsertionsServiceDataSource', `https://${insertionsServiceRestApi.restApiId}.execute-api.${this.region}.amazonaws.com`, {
      authorizationConfig: {
        signingRegion: this.region,
        signingServiceName: 'execute-api'
      }
    });

    iam.Role.fromRoleArn(this, 'InsertionsServiceDataSourceRole', insertionsServiceDs.ds.serviceRoleArn!)
      .attachInlinePolicy(new iam.Policy(this, 'InsertionsServiceDataSourcePolicy', {
        statements: [
          new iam.PolicyStatement({
            actions: [ 'execute-api:Invoke' ],
            effect: iam.Effect.ALLOW,
            resources: [ insertionsServiceRestApi.arnForExecuteApi() ]
          })
        ]
      }));

    // search service
    const searchServiceDs = api.addElasticSearchDataSource('SearchServiceDataSource', props.esDomain);

    // conversations service
    const conversationsServiceGraphqlUrl = cdk.Fn.join('', cdk.Fn.split('/graphql', props.conversationsServiceApi.graphqlUrl));
    const conversationsServiceDs = api.addHttpDataSource('ConversationsServiceDataSource', conversationsServiceGraphqlUrl, {
      authorizationConfig: {
        signingRegion: this.region,
        signingServiceName: 'appsync'
      }
    });
    const conversationsSubsDs = api.addNoneDataSource('ConversationsServiceSubsDataSource');

    const conversationsServiceDSRole = iam.Role.fromRoleArn(this, 'ConversationsServiceDataSourceRole', conversationsServiceDs.ds.serviceRoleArn!);
    props.conversationsServiceApi.grant(conversationsServiceDSRole, appsync.IamResource.all(), 'appsync:GraphQL');

    // resolvers
    usersServiceDs.createResolver({
      typeName: 'Query',
      fieldName: 'me',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/users/Query.me.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/users/Query.me.res.vtl'))
    });

    insertionsServiceDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'createInsertion',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/insertions/Mutation.createInsertion.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/insertions/Mutation.createInsertion.res.vtl'))
    });

    usersServiceDs.createResolver({
      typeName: 'Insertion',
      fieldName: 'tutor',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/insertions/Insertion.Tutor.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/insertions/Insertion.Tutor.res.vtl'))
    });

    searchServiceDs.createResolver({
      typeName: 'User',
      fieldName: 'insertions',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/users/User.Insertions.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/users/User.Insertions.res.vtl'))
    });

    searchServiceDs.createResolver({
      typeName: 'Query',
      fieldName: 'getInsertions',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/insertions/Query.getInsertions.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/insertions/Query.getInsertions.res.vtl'))
    });

    insertionsServiceDs.createResolver({
      typeName: 'Query',
      fieldName: 'getInsertion',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/insertions/Query.getInsertion.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/insertions/Query.getInsertion.res.vtl'))
    });

    conversationsServiceDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'createConversation',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/conversations/Mutation.createConversation.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/conversations/Mutation.createConversation.res.vtl'))
    });

    conversationsServiceDs.createResolver({
      typeName: 'User',
      fieldName: 'conversations',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/users/User.Conversations.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/users/User.Conversations.res.vtl'))
    });

    usersServiceDs.createResolver({
      typeName: 'ConvLink',
      fieldName: 'user',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/conversations/ConvLink.User.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/conversations/ConvLink.User.res.vtl'))
    });

    conversationsServiceDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'createMessage',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/conversations/Mutation.createMessage.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/conversations/Mutation.createMessage.res.vtl'))
    });

    usersServiceDs.createResolver({
      typeName: 'Message',
      fieldName: 'author',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/conversations/Message.Author.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/conversations/Message.Author.res.vtl'))
    });

    conversationsServiceDs.createResolver({
      typeName: 'User',
      fieldName: 'messages',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/users/User.Messages.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/users/User.Messages.res.vtl'))
    });

    conversationsServiceDs.createResolver({
      typeName: 'Conversation',
      fieldName: 'associated',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/conversations/Conversation.Associated.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/conversations/Conversation.Associated.res.vtl'))
    });

    conversationsServiceDs.createResolver({
      typeName: 'ConvLink',
      fieldName: 'conversation',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/conversations/ConvLink.Conversation.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/conversations/ConvLink.Conversation.res.vtl'))
    });

    conversationsServiceDs.createResolver({
      typeName: 'Message',
      fieldName: 'conversation',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/conversations/Message.Conversation.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/conversations/Message.Conversation.res.vtl'))
    });

    conversationsSubsDs.createResolver({
      typeName: 'Subscription',
      fieldName: 'onCreateConversation',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/conversations/Subscription.OnCreateConversation.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/conversations/Subscription.OnCreateConversation.res.vtl'))
    });

    conversationsServiceDs.createResolver({
      typeName: 'Query',
      fieldName: 'getConversations',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/conversations/Query.getConversations.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/conversations/Query.getConversations.res.vtl'))
    });

    conversationsServiceDs.createResolver({
      typeName: 'Query',
      fieldName: 'getMessages',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/conversations/Query.getMessages.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/conversations/Query.getMessages.res.vtl'))
    });

    searchServiceDs.createResolver({
      typeName: 'Query',
      fieldName: 'getUserInsertions',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/insertions/Query.getUserInsertions.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/insertions/Query.getUserInsertions.res.vtl'))
    });
  }
}
