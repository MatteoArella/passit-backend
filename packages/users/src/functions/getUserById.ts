import { CognitoIdentityServiceProvider } from 'aws-sdk';
import { APIGatewayProxyHandler } from 'aws-lambda';
import { HttpResponse, HttpErrorResponse } from '@passit/core-functions';
import { User } from './models/user';

const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider({ apiVersion: '2016-04-18' });

type FunctionParams = {
  userId: string;
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const res = new HttpResponse<User | HttpErrorResponse>();
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

  const response = await cognitoIdentityServiceProvider.listUsers({
    UserPoolId: (process.env.USER_POOL_ID as string),
    Filter: `sub =\"${params.userId}\"`
  }).promise();

  if (response.Users?.length === 0) {
    return res.status(404).json({ message: 'user not found' });
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
    return res.status(200).json(user);
  } else {
    return res.status(404).json({ message: 'user not found' });
  }
};
