export const logger = {
  info: (message: string) => console.log(`\x1b[36m[INFO]\x1b[0m ${message}`),
  success: (message: string) =>
    console.log(`\x1b[32m[SUCCESS]\x1b[0m ${message}`),
  warning: (message: string) =>
    console.log(`\x1b[33m[WARNING]\x1b[0m ${message}`),
  error: (message: string) => console.log(`\x1b[31m[ERROR]\x1b[0m ${message}`),
};
