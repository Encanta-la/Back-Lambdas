import {
  DefineAuthChallengeTriggerEvent,
  DefineAuthChallengeTriggerHandler,
} from 'aws-lambda';

export const handler: DefineAuthChallengeTriggerHandler = async (
  event: DefineAuthChallengeTriggerEvent
) => {
  try {
    if (event.request.userNotFound) {
      event.response.failAuthentication = true;
      event.response.issueTokens = false;
      throw new Error('User does not exist');
    }

    if (
      event.request.session &&
      event.request.session.length > 0 &&
      event.request.session.slice(-1)[0].challengeResult === true
    ) {
      // Código correto - confirma usuário
      event.response.failAuthentication = false;
      event.response.issueTokens = true;
    } else {
      // Primeira tentativa ou ainda tem tentativas
      event.response.challengeName = 'CUSTOM_CHALLENGE';
      event.response.failAuthentication = false;
      event.response.issueTokens = false;
    }
  } catch (error) {
    console.error('DefineAuthChallenge Error:', error);
    throw error;
  }
  return event;
};
