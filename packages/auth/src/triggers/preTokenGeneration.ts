import { PreTokenGenerationTriggerEvent, Context } from 'aws-lambda';
import { S3, CognitoIdentityServiceProvider } from 'aws-sdk';
import Avatars from '@dicebear/avatars';
import sprites from '@dicebear/avatars-jdenticon-sprites';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { join } from 'path';

const s3 = new S3({ apiVersion: '2006-03-01' });
const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider({ apiVersion: '2016-04-18' });
const avatars = new Avatars(sprites, {
  width: 96,
  height: 96,
  background: '#f0f0f0'
});

export const handler = async (event: PreTokenGenerationTriggerEvent, _: Context): Promise<PreTokenGenerationTriggerEvent> => {
  if (event.request.userAttributes.picture !== undefined) {
    return event;
  } else {
    const seed = `${event.request.userAttributes['family_name']} ${event.request.userAttributes['given_name']}`;
    const avatar = avatars.create(seed);

    const content = await sharp(Buffer.from(avatar)).jpeg({ progressive: true }).toBuffer();
    // upload file to S3 bucket
    const data = await s3.upload({
      Bucket: (process.env.BUCKET_NAME as string),
      Key: join((process.env.IMAGES_FOLDER as string), `picture-${uuidv4()}.jpeg`),
      Body: content
    }).promise();

    await cognitoIdentityServiceProvider.adminUpdateUserAttributes({
      UserPoolId: event.userPoolId,
      Username: event.userName,
      UserAttributes: [
        {
          Name: 'picture',
          Value: data.Location
        }
      ]
    }).promise();
    return event;
  }
};
