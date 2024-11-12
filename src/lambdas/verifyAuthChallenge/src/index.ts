interface ChallengeEvent {
  request: {
    privateChallengeParameters: {
      answer: string;
    };
    challengeAnswer: string;
  };
  response: {
    answerCorrect: boolean;
  };
  userName: string;
}

export const handler = async (event: ChallengeEvent) => {
  try {
    const expectedAnswer = event.request.privateChallengeParameters.answer;
    const userAnswer = event.request.challengeAnswer;

    event.response.answerCorrect = expectedAnswer === userAnswer;

    // Log resultado da verificação
    console.log(
      `Verification ${
        event.response.answerCorrect ? 'successful' : 'failed'
      } for user ${event.userName}`
    );

    return event;
  } catch (error) {
    console.error('VerifyAuthChallenge Error:', error);
    throw error;
  }
};

//  Teste de mudança 3
