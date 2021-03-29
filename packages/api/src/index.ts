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
  }
}
