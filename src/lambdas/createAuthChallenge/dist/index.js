"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const aws_xray_sdk_1 = require("aws-xray-sdk");
const client_sns_1 = require("@aws-sdk/client-sns");
const client_cloudwatch_1 = require("@aws-sdk/client-cloudwatch");
const logger_1 = require("./monitoring/logger");
const metrics_1 = require("./monitoring/metrics");
const sns = (0, aws_xray_sdk_1.captureAWSv3Client)(new client_sns_1.SNS({
    region: 'sa-east-1',
    maxAttempts: 2,
}));
const maskPhoneNumber = (phoneNumber) => {
    var _a, _b;
    const countryCode = (_b = (_a = phoneNumber.match(/^\+\d{2}/)) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : '';
    const lastFourDigits = phoneNumber.slice(-4);
    const maskLength = phoneNumber.length - countryCode.length - 4;
    return `${countryCode}${'X'.repeat(maskLength)}${lastFourDigits}`;
};
const generateSecretCode = () => Math.floor(100000 + Math.random() * 900000).toString();
const sendSMSCode = async (phone, code) => {
    const startTime = performance.now();
    try {
        await sns.publish({
            PhoneNumber: phone,
            Message: `Seu código de verificação é: ${code}`,
        });
        const duration = performance.now() - startTime;
        await metrics_1.metrics.publish([
            {
                name: 'SMSDuration',
                value: duration,
                unit: client_cloudwatch_1.StandardUnit.Milliseconds,
            },
        ]);
        logger_1.logger.info('SMS enviado com sucesso', {
            duration,
            phoneHash: maskPhoneNumber(phone),
        });
    }
    catch (error) {
        if (error instanceof Error) {
            logger_1.logger.error('Falha ao enviar SMS', error, {
                duration: performance.now() - startTime,
                phoneHash: maskPhoneNumber(phone),
            });
        }
        throw error;
    }
};
const handler = async (event) => {
    var _a, _b;
    const startTime = performance.now();
    try {
        logger_1.logger.info('Iniciando autenticação', {
            sessionLength: (_a = event.request.session) === null || _a === void 0 ? void 0 : _a.length,
        });
        const phone = event.request.userAttributes.phone_number;
        let secretLoginCode;
        if (!((_b = event.request.session) === null || _b === void 0 ? void 0 : _b.length)) {
            secretLoginCode = generateSecretCode();
            await sendSMSCode(phone, secretLoginCode);
        }
        else {
            const previousChallenge = event.request.session.slice(-1)[0];
            const match = previousChallenge.challengeMetadata.match(/CODE-(\d*)/);
            if (!match)
                throw new Error('Invalid challenge metadata format');
            secretLoginCode = match[1];
            logger_1.logger.info('Reutilizando código anterior', {
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
        await metrics_1.metrics.recordAuthAttempt(true, duration);
        logger_1.logger.info('Autenticação concluída com sucesso', { duration });
        return event;
    }
    catch (error) {
        const duration = performance.now() - startTime;
        await metrics_1.metrics.recordAuthAttempt(false, duration);
        if (error instanceof Error) {
            logger_1.logger.error('Falha na autenticação', error, { duration });
        }
        throw error;
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsK0NBQWtEO0FBQ2xELG9EQUEwQztBQUMxQyxrRUFBMEQ7QUFDMUQsZ0RBQTZDO0FBQzdDLGtEQUErQztBQXNCL0MsTUFBTSxHQUFHLEdBQUcsSUFBQSxpQ0FBa0IsRUFDNUIsSUFBSSxnQkFBRyxDQUFDO0lBQ04sTUFBTSxFQUFFLFdBQVc7SUFDbkIsV0FBVyxFQUFFLENBQUM7Q0FDZixDQUFDLENBQ0gsQ0FBQztBQUVGLE1BQU0sZUFBZSxHQUFHLENBQUMsV0FBbUIsRUFBVSxFQUFFOztJQUN0RCxNQUFNLFdBQVcsR0FBRyxNQUFBLE1BQUEsV0FBVyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsMENBQUcsQ0FBQyxDQUFDLG1DQUFJLEVBQUUsQ0FBQztJQUM3RCxNQUFNLGNBQWMsR0FBRyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDN0MsTUFBTSxVQUFVLEdBQUcsV0FBVyxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztJQUMvRCxPQUFPLEdBQUcsV0FBVyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLEdBQUcsY0FBYyxFQUFFLENBQUM7QUFDcEUsQ0FBQyxDQUFDO0FBRUYsTUFBTSxrQkFBa0IsR0FBRyxHQUFXLEVBQUUsQ0FDdEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLE1BQU0sQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDO0FBRXpELE1BQU0sV0FBVyxHQUFHLEtBQUssRUFBRSxLQUFhLEVBQUUsSUFBWSxFQUFpQixFQUFFO0lBQ3ZFLE1BQU0sU0FBUyxHQUFHLFdBQVcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUNwQyxJQUFJLENBQUM7UUFDSCxNQUFNLEdBQUcs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LGlCQUFpQixDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztRQUVoRCxlQUFNLENBQUMsSUFBSSxDQUFDLG9DQUFvQyxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUNoRSxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsTUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLEdBQUcsRUFBRSxHQUFHLFNBQVMsQ0FBQztRQUMvQyxNQUFNLGlCQUFPLENBQUMsaUJBQWlCLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBRWpELElBQUksS0FBSyxZQUFZLEtBQUssRUFBRSxDQUFDO1lBQzNCLGVBQU0sQ0FBQyxLQUFLLENBQUMsdUJBQXVCLEVBQUUsS0FBSyxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUM3RCxDQUFDO1FBQ0QsTUFBTSxLQUFLLENBQUM7SUFDZCxDQUFDO0FBQ0gsQ0FBQyxDQUFDO0FBL0NXLFFBQUEsT0FBTyxXQStDbEIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBjYXB0dXJlQVdTdjNDbGllbnQgfSBmcm9tICdhd3MteHJheS1zZGsnO1xuaW1wb3J0IHsgU05TIH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LXNucyc7XG5pbXBvcnQgeyBTdGFuZGFyZFVuaXQgfSBmcm9tICdAYXdzLXNkay9jbGllbnQtY2xvdWR3YXRjaCc7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tICcuL21vbml0b3JpbmcvbG9nZ2VyJztcbmltcG9ydCB7IG1ldHJpY3MgfSBmcm9tICcuL21vbml0b3JpbmcvbWV0cmljcyc7XG5cbmludGVyZmFjZSBDaGFsbGVuZ2VFdmVudCB7XG4gIHJlcXVlc3Q6IHtcbiAgICB1c2VyQXR0cmlidXRlczoge1xuICAgICAgcGhvbmVfbnVtYmVyOiBzdHJpbmc7XG4gICAgfTtcbiAgICBzZXNzaW9uPzogQXJyYXk8e1xuICAgICAgY2hhbGxlbmdlTWV0YWRhdGE6IHN0cmluZztcbiAgICB9PjtcbiAgfTtcbiAgcmVzcG9uc2U6IHtcbiAgICBwdWJsaWNDaGFsbGVuZ2VQYXJhbWV0ZXJzOiB7XG4gICAgICBwaG9uZTogc3RyaW5nO1xuICAgIH07XG4gICAgcHJpdmF0ZUNoYWxsZW5nZVBhcmFtZXRlcnM6IHtcbiAgICAgIGFuc3dlcjogc3RyaW5nO1xuICAgIH07XG4gICAgY2hhbGxlbmdlTWV0YWRhdGE6IHN0cmluZztcbiAgfTtcbn1cblxuY29uc3Qgc25zID0gY2FwdHVyZUFXU3YzQ2xpZW50KFxuICBuZXcgU05TKHtcbiAgICByZWdpb246ICdzYS1lYXN0LTEnLFxuICAgIG1heEF0dGVtcHRzOiAyLFxuICB9KVxuKTtcblxuY29uc3QgbWFza1Bob25lTnVtYmVyID0gKHBob25lTnVtYmVyOiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xuICBjb25zdCBjb3VudHJ5Q29kZSA9IHBob25lTnVtYmVyLm1hdGNoKC9eXFwrXFxkezJ9Lyk/LlswXSA/PyAnJztcbiAgY29uc3QgbGFzdEZvdXJEaWdpdHMgPSBwaG9uZU51bWJlci5zbGljZSgtNCk7XG4gIGNvbnN0IG1hc2tMZW5ndGggPSBwaG9uZU51bWJlci5sZW5ndGggLSBjb3VudHJ5Q29kZS5sZW5ndGggLSA0O1xuICByZXR1cm4gYCR7Y291bnRyeUNvZGV9JHsnWCcucmVwZWF0KG1hc2tMZW5ndGgpfSR7bGFzdEZvdXJEaWdpdHN9YDtcbn07XG5cbmNvbnN0IGdlbmVyYXRlU2VjcmV0Q29kZSA9ICgpOiBzdHJpbmcgPT5cbiAgTWF0aC5mbG9vcigxMDAwMDAgKyBNYXRoLnJhbmRvbSgpICogOTAwMDAwKS50b1N0cmluZygpO1xuXG5jb25zdCBzZW5kU01TQ29kZSA9IGFzeW5jIChwaG9uZTogc3RyaW5nLCBjb2RlOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgY29uc3Qgc3RhcnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gIHRyeSB7XG4gICAgYXdhaXQgc25zLnB1Ymxpc2goe1xuICAgICAgUGhvbmVOdW1iZXI6IHBob25lLFxuICAgICAgTWVzc2FnZTogYFNldSBjw7NkaWdvIGRlIHZlcmlmaWNhw6fDo28gw6k6ICR7Y29kZX1gLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZHVyYXRpb24gPSBwZXJmb3JtYW5jZS5ub3coKSAtIHN0YXJ0VGltZTtcbiAgICBhd2FpdCBtZXRyaWNzLnB1Ymxpc2goW1xuICAgICAge1xuICAgICAgICBuYW1lOiAnU01TRHVyYXRpb24nLFxuICAgICAgICB2YWx1ZTogZHVyYXRpb24sXG4gICAgICAgIHVuaXQ6IFN0YW5kYXJkVW5pdC5NaWxsaXNlY29uZHMsXG4gICAgICB9LFxuICAgIF0pO1xuXG4gICAgbG9nZ2VyLmluZm8oJ1NNUyBlbnZpYWRvIGNvbSBzdWNlc3NvJywge1xuICAgICAgZHVyYXRpb24sXG4gICAgICBwaG9uZUhhc2g6IG1hc2tQaG9uZU51bWJlcihwaG9uZSksXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgIGxvZ2dlci5lcnJvcignRmFsaGEgYW8gZW52aWFyIFNNUycsIGVycm9yLCB7XG4gICAgICAgIGR1cmF0aW9uOiBwZXJmb3JtYW5jZS5ub3coKSAtIHN0YXJ0VGltZSxcbiAgICAgICAgcGhvbmVIYXNoOiBtYXNrUGhvbmVOdW1iZXIocGhvbmUpLFxuICAgICAgfSk7XG4gICAgfVxuICAgIHRocm93IGVycm9yO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlciA9IGFzeW5jIChcbiAgZXZlbnQ6IENoYWxsZW5nZUV2ZW50XG4pOiBQcm9taXNlPENoYWxsZW5nZUV2ZW50PiA9PiB7XG4gIGNvbnN0IHN0YXJ0VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICB0cnkge1xuICAgIGxvZ2dlci5pbmZvKCdJbmljaWFuZG8gYXV0ZW50aWNhw6fDo28nLCB7XG4gICAgICBzZXNzaW9uTGVuZ3RoOiBldmVudC5yZXF1ZXN0LnNlc3Npb24/Lmxlbmd0aCxcbiAgICB9KTtcblxuICAgIGNvbnN0IHBob25lID0gZXZlbnQucmVxdWVzdC51c2VyQXR0cmlidXRlcy5waG9uZV9udW1iZXI7XG4gICAgbGV0IHNlY3JldExvZ2luQ29kZTogc3RyaW5nO1xuXG4gICAgaWYgKCFldmVudC5yZXF1ZXN0LnNlc3Npb24/Lmxlbmd0aCkge1xuICAgICAgc2VjcmV0TG9naW5Db2RlID0gZ2VuZXJhdGVTZWNyZXRDb2RlKCk7XG4gICAgICBhd2FpdCBzZW5kU01TQ29kZShwaG9uZSwgc2VjcmV0TG9naW5Db2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgcHJldmlvdXNDaGFsbGVuZ2UgPSBldmVudC5yZXF1ZXN0LnNlc3Npb24uc2xpY2UoLTEpWzBdO1xuICAgICAgY29uc3QgbWF0Y2ggPSBwcmV2aW91c0NoYWxsZW5nZS5jaGFsbGVuZ2VNZXRhZGF0YS5tYXRjaCgvQ09ERS0oXFxkKikvKTtcbiAgICAgIGlmICghbWF0Y2gpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjaGFsbGVuZ2UgbWV0YWRhdGEgZm9ybWF0Jyk7XG4gICAgICBzZWNyZXRMb2dpbkNvZGUgPSBtYXRjaFsxXTtcbiAgICAgIGxvZ2dlci5pbmZvKCdSZXV0aWxpemFuZG8gY8OzZGlnbyBhbnRlcmlvcicsIHtcbiAgICAgICAgYXR0ZW1wdE51bWJlcjogZXZlbnQucmVxdWVzdC5zZXNzaW9uLmxlbmd0aCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGV2ZW50LnJlc3BvbnNlLnB1YmxpY0NoYWxsZW5nZVBhcmFtZXRlcnMgPSB7XG4gICAgICBwaG9uZTogbWFza1Bob25lTnVtYmVyKHBob25lKSxcbiAgICB9O1xuICAgIGV2ZW50LnJlc3BvbnNlLnByaXZhdGVDaGFsbGVuZ2VQYXJhbWV0ZXJzID0ge1xuICAgICAgYW5zd2VyOiBzZWNyZXRMb2dpbkNvZGUsXG4gICAgfTtcbiAgICBldmVudC5yZXNwb25zZS5jaGFsbGVuZ2VNZXRhZGF0YSA9IGBDT0RFLSR7c2VjcmV0TG9naW5Db2RlfWA7XG5cbiAgICBjb25zdCBkdXJhdGlvbiA9IHBlcmZvcm1hbmNlLm5vdygpIC0gc3RhcnRUaW1lO1xuICAgIGF3YWl0IG1ldHJpY3MucmVjb3JkQXV0aEF0dGVtcHQodHJ1ZSwgZHVyYXRpb24pO1xuXG4gICAgbG9nZ2VyLmluZm8oJ0F1dGVudGljYcOnw6NvIGNvbmNsdcOtZGEgY29tIHN1Y2Vzc28nLCB7IGR1cmF0aW9uIH0pO1xuICAgIHJldHVybiBldmVudDtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zdCBkdXJhdGlvbiA9IHBlcmZvcm1hbmNlLm5vdygpIC0gc3RhcnRUaW1lO1xuICAgIGF3YWl0IG1ldHJpY3MucmVjb3JkQXV0aEF0dGVtcHQoZmFsc2UsIGR1cmF0aW9uKTtcblxuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICBsb2dnZXIuZXJyb3IoJ0ZhbGhhIG5hIGF1dGVudGljYcOnw6NvJywgZXJyb3IsIHsgZHVyYXRpb24gfSk7XG4gICAgfVxuICAgIHRocm93IGVycm9yO1xuICB9XG59O1xuIl19