import { handler, generateStrongPassword } from '../index';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { CognitoIdentityProvider } from '@aws-sdk/client-cognito-identity-provider';

jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-cognito-identity-provider');

describe('Verify Handler', () => {
  let mockContext: any;
  let mockCallback: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.PENDING_TABLE = 'test-pending-table';
    process.env.USER_POOL_ID = 'test-user-pool';
    process.env.CLIENT_ID = 'test-client-id';

    mockContext = {
      awsRequestId: 'test-request-id',
    };
    mockCallback = jest.fn();
  });

  it('should return error when no pending verification exists', async () => {
    (DynamoDB.prototype.getItem as jest.Mock).mockResolvedValue({ Item: null });

    const event = {
      phoneNumber: '+1234567890',
      code: '123456',
    };

    await handler(event, mockContext, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith(
      expect.stringContaining('No pending verification found for this number')
    );
  });

  it('should return error when verification code is invalid', async () => {
    (DynamoDB.prototype.getItem as jest.Mock).mockResolvedValue({
      Item: {
        phoneNumber: { S: '+1234567890' },
        verificationCode: { S: '999999' },
        name: { S: 'Test User' },
      },
    });

    const event = {
      phoneNumber: '+1234567890',
      code: '123456',
    };

    await handler(event, mockContext, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith(
      expect.stringContaining('Invalid verification code')
    );
  });

  it('should successfully verify and create user', async () => {
    // Mock DynamoDB response
    (DynamoDB.prototype.getItem as jest.Mock).mockResolvedValue({
      Item: {
        phoneNumber: { S: '+1234567890' },
        verificationCode: { S: '123456' },
        name: { S: 'Test User' },
      },
    });

    // Mock Cognito responses
    (CognitoIdentityProvider.prototype.signUp as jest.Mock).mockResolvedValue(
      {}
    );
    (
      CognitoIdentityProvider.prototype.adminConfirmSignUp as jest.Mock
    ).mockResolvedValue({});
    (
      CognitoIdentityProvider.prototype.adminUpdateUserAttributes as jest.Mock
    ).mockResolvedValue({});
    (
      CognitoIdentityProvider.prototype.initiateAuth as jest.Mock
    ).mockResolvedValue({
      AuthenticationResult: {
        AccessToken: 'test-access-token',
        RefreshToken: 'test-refresh-token',
        IdToken: 'test-id-token',
        ExpiresIn: 3600,
        TokenType: 'Bearer',
      },
    });
    (DynamoDB.prototype.deleteItem as jest.Mock).mockResolvedValue({});

    const event = {
      phoneNumber: '+1234567890',
      code: '123456',
    };

    await handler(event, mockContext, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        statusCode: 200,
        body: expect.objectContaining({
          message: 'User verified and created successfully',
          tokens: expect.any(Object),
        }),
      })
    );

    // Verify all AWS services were called
    expect(DynamoDB.prototype.getItem).toHaveBeenCalled();
    expect(CognitoIdentityProvider.prototype.signUp).toHaveBeenCalled();
    expect(
      CognitoIdentityProvider.prototype.adminConfirmSignUp
    ).toHaveBeenCalled();
    expect(
      CognitoIdentityProvider.prototype.adminUpdateUserAttributes
    ).toHaveBeenCalled();
    expect(CognitoIdentityProvider.prototype.initiateAuth).toHaveBeenCalled();
    expect(DynamoDB.prototype.deleteItem).toHaveBeenCalled();
  });

  it('should handle internal server error', async () => {
    (DynamoDB.prototype.getItem as jest.Mock).mockRejectedValue(
      new Error('Database error')
    );

    const event = {
      phoneNumber: '+1234567890',
      code: '123456',
    };

    await handler(event, mockContext, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith(
      expect.stringContaining('Internal server error')
    );
  });
});

describe('Password Generator', () => {
  it('should generate strong password with required characteristics', () => {
    const password = generateStrongPassword();

    expect(password).toMatch(/^.{12,}$/); // At least 12 characters
    expect(password).toMatch(/[A-Z]/); // Contains uppercase
    expect(password).toMatch(/[a-z]/); // Contains lowercase
    expect(password).toMatch(/[2-9]/); // Contains number
    expect(password).toMatch(/[#@$%&*!?]/); // Contains special character
  });
});
