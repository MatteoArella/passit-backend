import * as cdk from '@aws-cdk/core';
import * as cr from '@aws-cdk/custom-resources';
import * as cognito from '@aws-cdk/aws-cognito';
import * as s3 from '@aws-cdk/aws-s3';
import * as iam from '@aws-cdk/aws-iam';
import { join } from 'path';
import * as dotenv from 'dotenv';
import env from 'env-var';
import * as core from '@passit/core-infra';

dotenv.config();

export interface AuthStackProps extends cdk.NestedStackProps {
  storageBucket: s3.Bucket;
}

export class AuthStack extends cdk.NestedStack {
  public readonly userPool: cognito.IUserPool;
  public readonly identityPool: cognito.CfnIdentityPool
  public readonly client: cognito.UserPoolClient;
  public readonly clientSecret: string;
  public readonly authenticatedRole: iam.Role;

  public readonly domainPrefix: string;
  public readonly userPoolDomain: string;
  public readonly callbackUrl: string;
  public readonly logoutUrl: string;
  public readonly googleClientId: string;

  constructor(scope: cdk.Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    this.domainPrefix = env.get('USER_POOL_DOMAIN_PREFIX').required().asString();
    this.userPoolDomain = `${this.domainPrefix}.auth.${this.region}.amazoncognito.com`;
    this.callbackUrl = `${this.domainPrefix}://callback/`;
    this.logoutUrl = `${this.domainPrefix}://signout/`;
    this.googleClientId = env.get('GOOGLE_WEB_CLIENT_ID').required().asString();

    const preAuthenticationTrigger = new core.Function(this, 'PreAuthenticationLambda', {
      functionName: 'pre-authentication-function',
      entry: join(__dirname, 'triggers/preAuthentication.ts'),
      handler: 'handler'
    });

    const preTokenGenerationTrigger = new core.Function(this, 'PreTokenGenerationLambda', {
      functionName: 'pre-token-generation-function',
      entry: join(__dirname, 'triggers/preTokenGeneration.ts'),
      handler: 'handler',
      environment: {
        BUCKET_NAME: props.storageBucket.bucketName,
        IMAGES_FOLDER: 'public/images'
      },
      bundling: {
        nodeModules: [
          '@dicebear/avatars',
          '@dicebear/avatars-jdenticon-sprites',
          'sharp',
          'uuid'
        ]
      }
    });

    props.storageBucket.grantWrite(preTokenGenerationTrigger, 'public/images/*');

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'passit-project-userpool',
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      enableSmsRole: false,
      mfa: cognito.Mfa.OFF,
      passwordPolicy: {
        minLength: 12,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(5)
      },
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: false
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true
        },
        familyName: {
          required: true,
          mutable: true
        },
        givenName: {
          required: true,
          mutable: true
        }
      },
      lambdaTriggers: {
        preAuthentication: preAuthenticationTrigger,
        preTokenGeneration: preTokenGenerationTrigger
      }
    });

    preAuthenticationTrigger.role!.attachInlinePolicy(new iam.Policy(this, 'PreAuthenticationTriggerPolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: [ 'cognito-idp:ListUsers' ],
          resources: [ this.userPool.userPoolArn ]
        })
      ]
    }));

    preTokenGenerationTrigger.role!.attachInlinePolicy(new iam.Policy(this, 'PreTokenGenerationTriggerPolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: [ 'cognito-idp:adminUpdateUserAttributes' ],
          resources: [ this.userPool.userPoolArn ]
        })
      ]
    }));

    new cognito.UserPoolDomain(this, 'UserPoolDomain', {
      userPool: this.userPool,
      cognitoDomain: {
        domainPrefix: this.domainPrefix
      }
    });

    const googleIdentityProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleIdentityProvider', {
      clientId: this.googleClientId,
      clientSecret: env.get('GOOGLE_WEB_CLIENT_SECRET').required().asString(),
      userPool: this.userPool,
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL,
        phoneNumber: cognito.ProviderAttribute.GOOGLE_PHONE_NUMBERS,
        familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
        givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
        middleName: cognito.ProviderAttribute.GOOGLE_NAME,
        birthdate: cognito.ProviderAttribute.GOOGLE_BIRTHDAYS,
        profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
        gender: cognito.ProviderAttribute.GOOGLE_GENDER,
      },
      scopes: [
        'profile',
        'email',
        'openid',
        'phone'
      ]
    });

    this.client = new cognito.UserPoolClient(this, 'MobileClient', {
      userPool: this.userPool,
      authFlows: {
        userSrp: true,
        userPassword: true
      },
      generateSecret: true,
      preventUserExistenceErrors: true,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
          cognito.OAuthScope.PHONE,
          cognito.OAuthScope.COGNITO_ADMIN
        ],
        callbackUrls: [ this.callbackUrl ],
        logoutUrls: [ this.logoutUrl ]
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        cognito.UserPoolClientIdentityProvider.GOOGLE
      ]
    });

    // web client
    const webClient = new cognito.UserPoolClient(this, 'WebClient', {
      userPool: this.userPool,
      preventUserExistenceErrors: true
    });

    this.client.node.addDependency(googleIdentityProvider);

    this.identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: this.client.userPoolClientId,
          providerName: (this.userPool as cognito.UserPool).userPoolProviderName,
        },
        {
          clientId: webClient.userPoolClientId,
          providerName: (this.userPool as cognito.UserPool).userPoolProviderName,
        }
      ],
      supportedLoginProviders: {
        'accounts.google.com': env.get('GOOGLE_ANDROID_CLIENT_ID').required().asString()
      }
    });

    const unauthenticatedRole = new iam.Role(this, 'CognitoDefaultUnauthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal('cognito-identity.amazonaws.com', {
        'StringEquals': { 'cognito-identity.amazonaws.com:aud': this.identityPool.ref },
        'ForAnyValue:StringLike': { 'cognito-identity.amazonaws.com:amr': 'unauthenticated' },
      }, 'sts:AssumeRoleWithWebIdentity')
    });
    unauthenticatedRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'mobileanalytics:PutEvents',
        'cognito-sync:*'
      ],
      resources: [ '*' ],
    }));

    this.authenticatedRole = new iam.Role(this, 'CognitoDefaultAuthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal('cognito-identity.amazonaws.com', {
        'StringEquals': { 'cognito-identity.amazonaws.com:aud': this.identityPool.ref },
        'ForAnyValue:StringLike': { 'cognito-identity.amazonaws.com:amr': 'authenticated' },
      }, 'sts:AssumeRoleWithWebIdentity')
    });
    this.authenticatedRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'mobileanalytics:PutEvents',
        'cognito-sync:*',
        'cognito-identity:*'
      ],
      resources: [ '*' ],
    }));

    props.storageBucket.grantReadWrite(this.authenticatedRole);

    new cognito.CfnIdentityPoolRoleAttachment(this, 'DefaultValid', {
      identityPoolId: this.identityPool.ref,
      roles: {
        'unauthenticated': unauthenticatedRole.roleArn,
        'authenticated': this.authenticatedRole.roleArn
      }
    });

    const describeCognitoUserPoolClient = new cr.AwsCustomResource(this, 'DescribeCognitoUserPoolClient', {
      resourceType: 'Custom::DescribeCognitoUserPoolClient',
      onCreate: {
        region: this.region,
        service: 'CognitoIdentityServiceProvider',
        action: 'describeUserPoolClient',
        parameters: {
          UserPoolId: this.userPool.userPoolId,
          ClientId: this.client.userPoolClientId,
        },
        physicalResourceId: cr.PhysicalResourceId.of(this.client.userPoolClientId),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    this.clientSecret = describeCognitoUserPoolClient.getResponseField('UserPoolClient.ClientSecret');
  }
}
