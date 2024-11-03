interface TimestampFormat {
  utc: string;
  brasilia: string;
}

interface LogData {
  [key: string]: any;
}

interface LogObject {
  level: string;
  timestamp: TimestampFormat;
  message: string;
  errorName?: string;
  errorMessage?: string;
  stackTrace?: string;
  data: LogData;
  requestId: string | undefined;
  functionName: string | undefined;
  functionVersion: string | undefined;
  environment: string;
}

const createLogObject = (
  level: string,
  message: string,
  data: LogData = {},
  error: Error | null = null
): LogObject => {
  const now = new Date();

  const utcTimestamp = now.toISOString();
  const brasiliaTimestamp = now.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return {
    level,
    timestamp: {
      utc: utcTimestamp,
      brasilia: brasiliaTimestamp,
    },
    message,
    ...(error && {
      errorName: error.name,
      errorMessage: error.message,
      stackTrace: error.stack,
    }),
    data,
    requestId: process.env.AWS_LAMBDA_REQUEST_ID,
    functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
    functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
    environment: process.env.ENVIRONMENT || 'production',
  };
};

export const logger = {
  info: (message: string, data: LogData = {}): void => {
    console.log(JSON.stringify(createLogObject('INFO', message, data)));
  },
  error: (message: string, error: Error, data: LogData = {}): void => {
    console.error(
      JSON.stringify(createLogObject('ERROR', message, data, error))
    );
  },
  warn: (message: string, data: LogData = {}): void => {
    console.warn(JSON.stringify(createLogObject('WARN', message, data)));
  },
};
