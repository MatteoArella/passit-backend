import { CognitoIdentityServiceProvider } from 'aws-sdk';
import { APIGatewayProxyHandler, APIGatewayProxyResult, Context } from 'aws-lambda';
import { User } from './models/user';

const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider({ apiVersion: '2016-04-18' });

type FunctionParams = {
  userId: string;
};

export const handler: APIGatewayProxyHandler = async (event, _: Context) => {
  const userAttributesMapping: any = {
    'sub': 'id',
    'email': 'email',
    'given_name': 'givenName',
    'family_name': 'familyName',
    'phone_number': 'phoneNumber',
    'birthdate': 'birthDate',
    'picture': 'picture'
  };

  const params = event.pathParameters as FunctionParams;
  const res: APIGatewayProxyResult = {
    statusCode: 404,
    body: JSON.stringify({
      message: 'user not found'
    })
  };

  const response = await cognitoIdentityServiceProvider.listUsers({
    UserPoolId: (process.env.USER_POOL_ID as string),
    Filter: `sub =\"${params.userId}\"`
  }).promise();

  if (response.Users?.length === 0) {
    return res;
  }

  const cognitoUser = response.Users?.pop();
  const user = cognitoUser?.Attributes?.reduce((user: User, obj: CognitoIdentityServiceProvider.AttributeType) => {
    if (userAttributesMapping[obj.Name] !== undefined) {
      user[userAttributesMapping[obj.Name]] = obj.Value || '';
    }
    return user;
  }, {} as User) || undefined;

  if (user) {
    user.createdAt = cognitoUser!.UserCreateDate?.toISOString()!;
    user.updatedAt = cognitoUser!.UserLastModifiedDate?.toISOString();
    return { statusCode: 200, body: JSON.stringify(user) };
  } else {
    return res;
  }
};
