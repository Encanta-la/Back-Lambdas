import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { CognitoIdentityProvider } from '@aws-sdk/client-cognito-identity-provider';
import { SNS } from '@aws-sdk/client-sns';
import { captureAWSv3Client } from 'aws-xray-sdk';
import { Context, Callback } from 'aws-lambda';

// Interfaces
interface EventInput {
  phoneNumber: string;
  name: string;
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
    confirmationDetails: {
      destination: string;
      deliveryMedium: string;
      attributeName: string;
    };
  };
}

// AWS Clients
const dynamo = new DynamoDB();
const cognito = captureAWSv3Client(new CognitoIdentityProvider());
const sns = captureAWSv3Client(new SNS({ region: 'sa-east-1' }));

// Helper Functions
export const generateCode = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const maskPhoneNumber = (phoneNumber: string): string => {
  const countryCode = phoneNumber.match(/^\+\d{2}/)?.[0] ?? '';
  const lastFourDigits = phoneNumber.slice(-4);
  const maskLength = phoneNumber.length - countryCode.length - 4;
  return `${countryCode}${'X'.repeat(maskLength)}${lastFourDigits}`;
};

export const handler = async (
  event: EventInput,
  context: Context,
  callback: Callback
): Promise<void> => {
  try {
    const { phoneNumber, name } = event;

    // 1. Verifica se usuário existe no Cognito
    try {
      await cognito.adminGetUser({
        UserPoolId: process.env.USER_POOL_ID,
        Username: phoneNumber,
      });

      const error: ErrorResponse = {
        errorType: 'ValidationError',
        httpStatus: 400,
        requestId: context.awsRequestId,
        message: 'User already exists',
      };
      return callback(JSON.stringify(error));
    } catch (error: any) {
      if (error.name !== 'UserNotFoundException') {
        throw error;
      }
    }

    const verificationCode = generateCode();

    // 2. Salva no DynamoDB
    await dynamo.putItem({
      TableName: process.env.PENDING_TABLE,
      Item: {
        phoneNumber: { S: phoneNumber },
        name: { S: name },
        verificationCode: { S: verificationCode },
        ttl: { N: (Math.floor(Date.now() / 1000) + 300).toString() }, // 5 min
        createdAt: { N: Date.now().toString() },
      },
    });

    // 3. Envia SMS
    await sns.publish({
      PhoneNumber: phoneNumber,
      Message: `P-${verificationCode} é o seu código de verificação Prime Gourmet.`,
    });

    // Sucesso
    const response: SuccessResponse = {
      statusCode: 200,
      body: {
        message: 'Verification code sent successfully',
        confirmationDetails: {
          destination: maskPhoneNumber(phoneNumber),
          deliveryMedium: 'SMS',
          attributeName: 'phone_number',
        },
      },
    };

    callback(null, response);
  } catch (error: any) {
    console.error('Register Error:', error);

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
