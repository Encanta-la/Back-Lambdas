import { handler, generateCode, maskPhoneNumber } from '../index';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { CognitoIdentityProvider } from '@aws-sdk/client-cognito-identity-provider';
import { SNS } from '@aws-sdk/client-sns';

// Mocks
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-cognito-identity-provider');
jest.mock('@aws-sdk/client-sns');
jest.mock('aws-xray-sdk', () => ({
  captureAWSv3Client: jest.fn((client) => client),
}));

describe('Registration Handler', () => {
  let mockContext: any;
  let mockCallback: jest.Mock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock environment variables
    process.env.USER_POOL_ID = 'test-pool-id';
    process.env.PENDING_TABLE = 'test-table';

    // Mock context and callback
    mockContext = {
      awsRequestId: 'test-request-id',
    };
    mockCallback = jest.fn();

    // Mock Date.now
    jest.spyOn(Date, 'now').mockImplementation(() => 1625097600000); // Fixed timestamp
  });

  it('should return error when user already exists', async () => {
    // Mock Cognito response for existing user
    (
      CognitoIdentityProvider.prototype.adminGetUser as jest.Mock
    ).mockResolvedValue({});

    const event = {
      phoneNumber: '+5511999999999',
      name: 'Test User',
    };

    await handler(event, mockContext, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith(
      expect.stringContaining('User already exists')
    );
  });

  it('should successfully register new user', async () => {
    // Mock Cognito throwing UserNotFoundException
    (
      CognitoIdentityProvider.prototype.adminGetUser as jest.Mock
    ).mockRejectedValue({ name: 'UserNotFoundException' });

    // Mock DynamoDB and SNS successful responses
    (DynamoDB.prototype.putItem as jest.Mock).mockResolvedValue({});
    (SNS.prototype.publish as jest.Mock).mockResolvedValue({});

    const event = {
      phoneNumber: '+5511999999999',
      name: 'Test User',
    };

    await handler(event, mockContext, mockCallback);

    // Verify successful response
    expect(mockCallback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        statusCode: 200,
        body: expect.objectContaining({
          message: 'Verification code sent successfully',
        }),
      })
    );

    // Verify DynamoDB was called
    expect(DynamoDB.prototype.putItem).toHaveBeenCalled();

    // Verify SNS was called
    expect(SNS.prototype.publish).toHaveBeenCalled();
  });

  it('should handle internal server error', async () => {
    // Mock Cognito throwing unexpected error
    (
      CognitoIdentityProvider.prototype.adminGetUser as jest.Mock
    ).mockRejectedValue(new Error('Unexpected error'));

    const event = {
      phoneNumber: '+5511999999999',
      name: 'Test User',
    };

    await handler(event, mockContext, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith(
      expect.stringContaining('Internal server error')
    );
  });

  it('should mask phone number correctly', async () => {
    (
      CognitoIdentityProvider.prototype.adminGetUser as jest.Mock
    ).mockRejectedValue({ name: 'UserNotFoundException' });
    (DynamoDB.prototype.putItem as jest.Mock).mockResolvedValue({});
    (SNS.prototype.publish as jest.Mock).mockResolvedValue({});

    const event = {
      phoneNumber: '+5511999999999',
      name: 'Test User',
    };

    await handler(event, mockContext, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        body: expect.objectContaining({
          confirmationDetails: expect.objectContaining({
            destination: '+55XXXXXXX9999',
          }),
        }),
      })
    );
  });
});

describe('Helper Functions', () => {
  it('should generate 6-digit verification code', () => {
    const code = generateCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('should mask phone number correctly', () => {
    const maskedNumber = maskPhoneNumber('+5511999999999');
    expect(maskedNumber).toBe('+55XXXXXXX9999');
  });
});
