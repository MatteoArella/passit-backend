import * as cdk from '@aws-cdk/core';
import { ApiStack } from '@passit/api-service';
import { StorageStack } from '@passit/storage-service';
import { AuthStack } from '@passit/auth-service';
import { UsersStack } from '@passit/users-service';
import { InsertionsStack } from '@passit/insertions-service';
import { SearchStack } from '@passit/search-service';
import { ConversationsStack } from '@passit/conversations-service';

class AppStack extends cdk.Stack {
  constructor(scope?: cdk.Construct, id?: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const conversationsStack = new ConversationsStack(this, 'ConversationsStack');

    const searchStack = new SearchStack(this, 'SearchStack');

    const storageStack = new StorageStack(this, 'StorageStack');

    const authStack = new AuthStack(this, 'AuthStack', {
      storageBucket: storageStack.bucket
    });

    const usersStack = new UsersStack(this, 'UsersStack', {
      userPool: authStack.userPool
    });

    const insertionsStack = new InsertionsStack(this, 'InsertionsStack', {
      esDomain: searchStack.domain
    });

    const apiStack = new ApiStack(this, 'ApiStack', {
      userPool: authStack.userPool,
      authenticatedRole: authStack.authenticatedRole,
      esDomain: searchStack.domain,
      conversationsServiceApi: conversationsStack.api
    });

    apiStack.addDependency(usersStack);
    apiStack.addDependency(insertionsStack);
    apiStack.addDependency(conversationsStack);

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: authStack.userPool.userPoolId
    });

    new cdk.CfnOutput(this, 'UserPoolAppClientId', {
      value: authStack.client.userPoolClientId
    });

    new cdk.CfnOutput(this, 'UserPoolAppClientSecret', {
      value: authStack.clientSecret
    });

    new cdk.CfnOutput(this, 'UserPoolWebClientId', {
      value: authStack.webClient.userPoolClientId
    });

    new cdk.CfnOutput(this, 'GoogleClientId', {
      value: authStack.googleClientId
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: authStack.identityPool.ref
    });

    new cdk.CfnOutput(this, 'UserPoolDomain', {
      value: authStack.userPoolDomain
    });

    new cdk.CfnOutput(this, 'RedirectPrefix', {
      value: authStack.domainPrefix
    });

    new cdk.CfnOutput(this, 'UserPoolCallbackUrl', {
      value: authStack.callbackUrl
    });

    new cdk.CfnOutput(this, 'UserPoolLogoutUrl', {
      value: authStack.logoutUrl
    });

    new cdk.CfnOutput(this, 'APIID', {
      value: apiStack.api.apiId
    });

    new cdk.CfnOutput(this, 'APIUrl', {
      value: apiStack.api.graphqlUrl
    });

    new cdk.CfnOutput(this, 'StorageBucketName', {
      value: storageStack.bucket.bucketName
    });

    new cdk.CfnOutput(this, 'Region', {
      value: this.region
    });
  }
}

const app = new cdk.App();
new AppStack(app, 'AppStack');
