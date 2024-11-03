import { handler } from '../index';

describe('verifyAuthChallenge', () => {
  it('should return correct response for matching answers', async () => {
    const event = {
      request: {
        privateChallengeParameters: {
          answer: '12345',
        },
        challengeAnswer: '12345',
      },
      response: {
        answerCorrect: false,
      },
      userName: 'testUser',
    };

    const result = await handler(event);
    expect(result.response.answerCorrect).toBe(true);
  });

  it('should return incorrect response for non-matching answers', async () => {
    const event = {
      request: {
        privateChallengeParameters: {
          answer: '12345',
        },
        challengeAnswer: '54321',
      },
      response: {
        answerCorrect: false,
      },
      userName: 'testUser',
    };

    const result = await handler(event);
    expect(result.response.answerCorrect).toBe(false);
  });
});
