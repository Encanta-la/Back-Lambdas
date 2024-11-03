import { DefineAuthChallengeTriggerEvent, Context, Callback } from 'aws-lambda';
import { handler } from '../index';

describe('DefineAuthChallenge Lambda', () => {
  // Mock do Context
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'defineAuthChallenge',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda',
    memoryLimitInMB: '128',
    awsRequestId: '123',
    logGroupName: 'group',
    logStreamName: 'stream',
    getRemainingTimeInMillis: () => 1000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };

  // Mock do Callback
  const mockCallback: Callback = jest.fn();

  it('should fail authentication for non-existent user', async () => {
    const event: DefineAuthChallengeTriggerEvent = {
      version: '1',
      region: 'us-east-1',
      userPoolId: 'us-east-1_example',
      userName: 'testuser',
      callerContext: {
        awsSdkVersion: '1',
        clientId: 'example',
      },
      triggerSource: 'DefineAuthChallenge_Authentication',
      request: {
        userAttributes: {
          sub: 'test-sub',
          email: 'test@example.com',
        },
        userNotFound: true,
        session: [],
      },
      response: {
        failAuthentication: false,
        issueTokens: false,
        challengeName: undefined,
      },
    };

    await expect(handler(event, mockContext, mockCallback)).rejects.toThrow(
      'User does not exist'
    );
    expect(event.response.failAuthentication).toBe(true);
    expect(event.response.issueTokens).toBe(false);
  });

  it('should issue tokens when challenge is completed successfully', async () => {
    const event: DefineAuthChallengeTriggerEvent = {
      version: '1',
      region: 'us-east-1',
      userPoolId: 'us-east-1_example',
      userName: 'testuser',
      callerContext: {
        awsSdkVersion: '1',
        clientId: 'example',
      },
      triggerSource: 'DefineAuthChallenge_Authentication',
      request: {
        userAttributes: {
          sub: 'test-sub',
          email: 'test@example.com',
        },
        userNotFound: false,
        session: [
          {
            challengeName: 'CUSTOM_CHALLENGE',
            challengeResult: true,
          },
        ],
      },
      response: {
        failAuthentication: false,
        issueTokens: false,
        challengeName: undefined,
      },
    };

    const result = await handler(event, mockContext, mockCallback);
    expect(result.response.failAuthentication).toBe(false);
    expect(result.response.issueTokens).toBe(true);
  });

  it('should start custom challenge for first attempt', async () => {
    const event: DefineAuthChallengeTriggerEvent = {
      version: '1',
      region: 'us-east-1',
      userPoolId: 'us-east-1_example',
      userName: 'testuser',
      callerContext: {
        awsSdkVersion: '1',
        clientId: 'example',
      },
      triggerSource: 'DefineAuthChallenge_Authentication',
      request: {
        userAttributes: {
          sub: 'test-sub',
          email: 'test@example.com',
        },
        userNotFound: false,
        session: [],
      },
      response: {
        failAuthentication: false,
        issueTokens: false,
        challengeName: undefined,
      },
    };

    const result = await handler(event, mockContext, mockCallback);
    expect(result.response.failAuthentication).toBe(false);
    expect(result.response.issueTokens).toBe(false);
    expect(result.response.challengeName).toBe('CUSTOM_CHALLENGE');
  });
});
