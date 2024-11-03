import { captureAWSv3Client } from 'aws-xray-sdk';
import { SNS } from '@aws-sdk/client-sns';
import { StandardUnit } from '@aws-sdk/client-cloudwatch';
import { logger } from './monitoring/logger';
import { metrics } from './monitoring/metrics';

interface ChallengeEvent {
  request: {
    userAttributes: {
      phone_number: string;
    };
    session?: Array<{
      challengeMetadata: string;
    }>;
  };
  response: {
    publicChallengeParameters: {
      phone: string;
    };
    privateChallengeParameters: {
      answer: string;
    };
    challengeMetadata: string;
  };
}

const sns = captureAWSv3Client(
  new SNS({
    region: 'sa-east-1',
    maxAttempts: 2,
  })
);

const maskPhoneNumber = (phoneNumber: string): string => {
  const countryCode = phoneNumber.match(/^\+\d{2}/)?.[0] ?? '';
  const lastFourDigits = phoneNumber.slice(-4);
  const maskLength = phoneNumber.length - countryCode.length - 4;
  return `${countryCode}${'X'.repeat(maskLength)}${lastFourDigits}`;
};

const generateSecretCode = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

const sendSMSCode = async (phone: string, code: string): Promise<void> => {
  const startTime = performance.now();
  try {
    await sns.publish({
      PhoneNumber: phone,
      Message: `Seu código de verificação é: ${code}`,
    });

    const duration = performance.now() - startTime;
    await metrics.publish([
      {
        name: 'SMSDuration',
        value: duration,
        unit: StandardUnit.Milliseconds,
      },
    ]);

    logger.info('SMS enviado com sucesso', {
      duration,
      phoneHash: maskPhoneNumber(phone),
    });
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Falha ao enviar SMS', error, {
        duration: performance.now() - startTime,
        phoneHash: maskPhoneNumber(phone),
      });
    }
    throw error;
  }
};

export const handler = async (
  event: ChallengeEvent
): Promise<ChallengeEvent> => {
  const startTime = performance.now();
  try {
    logger.info('Iniciando autenticação', {
      sessionLength: event.request.session?.length,
    });

    const phone = event.request.userAttributes.phone_number;
    let secretLoginCode: string;

    if (!event.request.session?.length) {
      secretLoginCode = generateSecretCode();
      await sendSMSCode(phone, secretLoginCode);
    } else {
      const previousChallenge = event.request.session.slice(-1)[0];
      const match = previousChallenge.challengeMetadata.match(/CODE-(\d*)/);
      if (!match) throw new Error('Invalid challenge metadata format');
      secretLoginCode = match[1];
      logger.info('Reutilizando código anterior', {
        attemptNumber: event.request.session.length,
      });
    }

    event.response.publicChallengeParameters = {
      phone: maskPhoneNumber(phone),
    };
    event.response.privateChallengeParameters = {
      answer: secretLoginCode,
    };
    event.response.challengeMetadata = `CODE-${secretLoginCode}`;

    const duration = performance.now() - startTime;
    await metrics.recordAuthAttempt(true, duration);

    logger.info('Autenticação concluída com sucesso', { duration });
    return event;
  } catch (error) {
    const duration = performance.now() - startTime;
    await metrics.recordAuthAttempt(false, duration);

    if (error instanceof Error) {
      logger.error('Falha na autenticação', error, { duration });
    }
    throw error;
  }
};
