import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { CognitoIdentityProvider } from '@aws-sdk/client-cognito-identity-provider';
import { Context, Callback } from 'aws-lambda';

interface EventInput {
  phoneNumber: string;
  code: string;
}

interface ErrorResponse {
  errorType: string;
  httpStatus: number;
  requestId: string;
  message: string;
  trace?: {
    function: string;
    error: string;
    stack?: string;
  };
}

interface SuccessResponse {
  statusCode: number;
  body: {
    message: string;
    tokens: {
      accessToken: string;
      refreshToken: string;
      idToken: string;
      expiresIn: number;
      tokenType: string;
    };
  };
}

const dynamo = new DynamoDB();
const cognito = new CognitoIdentityProvider();

export const generateStrongPassword = (): string => {
  const chars = {
    upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
    lower: 'abcdefghijkmnpqrstuvwxyz',
    numbers: '23456789',
    special: '#@$%&*!?',
  };

  const getRandomChar = (str: string): string =>
    str[Math.floor(Math.random() * str.length)];

  const pass = [
    getRandomChar(chars.upper),
    getRandomChar(chars.lower),
    getRandomChar(chars.numbers),
    getRandomChar(chars.special),
  ];

  const allChars = chars.upper + chars.lower + chars.numbers + chars.special;
  for (let i = 0; i < 8; i++) {
    pass.push(getRandomChar(allChars));
  }

  for (let i = pass.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pass[i], pass[j]] = [pass[j], pass[i]];
  }

  return pass.join('');
};

export const handler = async (
  event: EventInput,
  context: Context,
  callback: Callback
): Promise<void> => {
  try {
    const { phoneNumber, code } = event;

    const pendingItem = await dynamo.getItem({
      TableName: process.env.PENDING_TABLE!,
      Key: {
        phoneNumber: { S: phoneNumber },
      },
    });

    if (!pendingItem.Item) {
      const error: ErrorResponse = {
        errorType: 'ValidationError',
        httpStatus: 400,
        requestId: context.awsRequestId,
        message: 'No pending verification found for this number.',
      };
      return callback(JSON.stringify(error));
    }

    if (pendingItem.Item.verificationCode.S !== code) {
      const error: ErrorResponse = {
        errorType: 'ValidationError',
        httpStatus: 400,
        requestId: context.awsRequestId,
        message: 'Invalid verification code',
      };
      return callback(JSON.stringify(error));
    }

    const password = generateStrongPassword();

    await cognito.signUp({
      ClientId: process.env.CLIENT_ID!,
      Username: phoneNumber,
      Password: password,
      UserAttributes: [
        {
          Name: 'phone_number',
          Value: phoneNumber,
        },
        {
          Name: 'name',
          Value: pendingItem.Item.name.S,
        },
      ],
    });

    await cognito.adminConfirmSignUp({
      UserPoolId: process.env.USER_POOL_ID!,
      Username: phoneNumber,
    });

    await cognito.adminUpdateUserAttributes({
      UserPoolId: process.env.USER_POOL_ID!,
      Username: phoneNumber,
      UserAttributes: [
        {
          Name: 'phone_number_verified',
          Value: 'true',
        },
      ],
    });

    const authResponse = await cognito.initiateAuth({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.CLIENT_ID!,
      AuthParameters: {
        USERNAME: phoneNumber,
        PASSWORD: password,
      },
    });

    await dynamo.deleteItem({
      TableName: process.env.PENDING_TABLE!,
      Key: {
        phoneNumber: { S: phoneNumber },
      },
    });

    const response: SuccessResponse = {
      statusCode: 200,
      body: {
        message: 'User verified and created successfully',
        tokens: {
          accessToken: authResponse.AuthenticationResult!.AccessToken!,
          refreshToken: authResponse.AuthenticationResult!.RefreshToken!,
          idToken: authResponse.AuthenticationResult!.IdToken!,
          expiresIn: authResponse.AuthenticationResult!.ExpiresIn!,
          tokenType: authResponse.AuthenticationResult!.TokenType!,
        },
      },
    };

    callback(null, response);
  } catch (error: any) {
    console.error('Verify Error:', error);

    const errorResponse: ErrorResponse = {
      errorType: 'InternalServerError',
      httpStatus: 500,
      requestId: context.awsRequestId,
      message: 'Internal server error',
      trace: {
        function: 'handler',
        error: error.message,
        stack: error.stack,
      },
    };

    callback(JSON.stringify(errorResponse));
  }
};
