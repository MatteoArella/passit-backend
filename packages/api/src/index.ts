import * as cdk from '@aws-cdk/core';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as appsync from '@aws-cdk/aws-appsync';
import * as cognito from '@aws-cdk/aws-cognito';
import * as iam from '@aws-cdk/aws-iam';
import * as core from '@passit/core-infra';
import { join } from 'path';

export interface ApiStackProps extends cdk.NestedStackProps {
  userPool: cognito.IUserPool;
  authenticatedRole: iam.Role;
}

export class ApiStack extends cdk.NestedStack {
  public readonly api: appsync.GraphqlApi;

  constructor(scope: cdk.Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const usersServiceRestApi = apigateway.RestApi.fromRestApiId(this, 'UsersServiceApiId', cdk.Fn.importValue('UsersServiceApiId'));
    const insertionsServiceRestApi = apigateway.RestApi.fromRestApiId(this, 'InsertionsServiceApiId', cdk.Fn.importValue('InsertionsServiceApiId'));

    this.api = new appsync.GraphqlApi(this, 'PassItGraphApi', {
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

    // users service
    const usersServiceDs = this.api.addHttpDataSource('UsersServiceDataSource', `https://${usersServiceRestApi.restApiId}.execute-api.${this.region}.amazonaws.com`, {
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

    usersServiceDs.createResolver({
      typeName: 'Query',
      fieldName: 'me',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/users/Query.me.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/users/Query.me.res.vtl'))
    });

    // insertions service
    const insertionsServiceDs = this.api.addHttpDataSource('InsertionsServiceDataSource', `https://${insertionsServiceRestApi.restApiId}.execute-api.${this.region}.amazonaws.com`, {
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

    insertionsServiceDs.createResolver({
      typeName: 'User',
      fieldName: 'insertions',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/users/User.Insertions.req.vtl')),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/users/User.Insertions.res.vtl'))
    });
  }
}
