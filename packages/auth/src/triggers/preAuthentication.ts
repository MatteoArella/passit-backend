import { PreAuthenticationTriggerEvent, Context } from 'aws-lambda';
import { CognitoIdentityServiceProvider } from 'aws-sdk';

const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider({ apiVersion: '2016-04-18' });

export const handler = async (event: PreAuthenticationTriggerEvent, _: Context): Promise<PreAuthenticationTriggerEvent> => {
  const response = await cognitoIdentityServiceProvider.listUsers({
    UserPoolId: event.userPoolId,
    Filter: `sub =\"${event.request.userAttributes.sub}\"`,
    Limit: 1
  }).promise();

  if (response.Users?.pop()?.UserStatus === 'UNCONFIRMED') {
    throw new Error('UNCONFIRMED');
  }
  return event;
};
