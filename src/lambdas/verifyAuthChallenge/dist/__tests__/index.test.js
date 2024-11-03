"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
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
        const result = await (0, index_1.handler)(event);
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
        const result = await (0, index_1.handler)(event);
        expect(result.response.answerCorrect).toBe(false);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9fX3Rlc3RzX18vaW5kZXgudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLG9DQUFtQztBQUVuQyxRQUFRLENBQUMscUJBQXFCLEVBQUUsR0FBRyxFQUFFO0lBQ25DLEVBQUUsQ0FBQyxxREFBcUQsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNuRSxNQUFNLEtBQUssR0FBRztZQUNaLE9BQU8sRUFBRTtnQkFDUCwwQkFBMEIsRUFBRTtvQkFDMUIsTUFBTSxFQUFFLE9BQU87aUJBQ2hCO2dCQUNELGVBQWUsRUFBRSxPQUFPO2FBQ3pCO1lBQ0QsUUFBUSxFQUFFO2dCQUNSLGFBQWEsRUFBRSxLQUFLO2FBQ3JCO1lBQ0QsUUFBUSxFQUFFLFVBQVU7U0FDckIsQ0FBQztRQUVGLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBQSxlQUFPLEVBQUMsS0FBSyxDQUFDLENBQUM7UUFDcEMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ25ELENBQUMsQ0FBQyxDQUFDO0lBRUgsRUFBRSxDQUFDLDJEQUEyRCxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ3pFLE1BQU0sS0FBSyxHQUFHO1lBQ1osT0FBTyxFQUFFO2dCQUNQLDBCQUEwQixFQUFFO29CQUMxQixNQUFNLEVBQUUsT0FBTztpQkFDaEI7Z0JBQ0QsZUFBZSxFQUFFLE9BQU87YUFDekI7WUFDRCxRQUFRLEVBQUU7Z0JBQ1IsYUFBYSxFQUFFLEtBQUs7YUFDckI7WUFDRCxRQUFRLEVBQUUsVUFBVTtTQUNyQixDQUFDO1FBRUYsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFBLGVBQU8sRUFBQyxLQUFLLENBQUMsQ0FBQztRQUNwQyxNQUFNLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDcEQsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGhhbmRsZXIgfSBmcm9tICcuLi9pbmRleCc7XG5cbmRlc2NyaWJlKCd2ZXJpZnlBdXRoQ2hhbGxlbmdlJywgKCkgPT4ge1xuICBpdCgnc2hvdWxkIHJldHVybiBjb3JyZWN0IHJlc3BvbnNlIGZvciBtYXRjaGluZyBhbnN3ZXJzJywgYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IGV2ZW50ID0ge1xuICAgICAgcmVxdWVzdDoge1xuICAgICAgICBwcml2YXRlQ2hhbGxlbmdlUGFyYW1ldGVyczoge1xuICAgICAgICAgIGFuc3dlcjogJzEyMzQ1JyxcbiAgICAgICAgfSxcbiAgICAgICAgY2hhbGxlbmdlQW5zd2VyOiAnMTIzNDUnLFxuICAgICAgfSxcbiAgICAgIHJlc3BvbnNlOiB7XG4gICAgICAgIGFuc3dlckNvcnJlY3Q6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIHVzZXJOYW1lOiAndGVzdFVzZXInLFxuICAgIH07XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBoYW5kbGVyKGV2ZW50KTtcbiAgICBleHBlY3QocmVzdWx0LnJlc3BvbnNlLmFuc3dlckNvcnJlY3QpLnRvQmUodHJ1ZSk7XG4gIH0pO1xuXG4gIGl0KCdzaG91bGQgcmV0dXJuIGluY29ycmVjdCByZXNwb25zZSBmb3Igbm9uLW1hdGNoaW5nIGFuc3dlcnMnLCBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgZXZlbnQgPSB7XG4gICAgICByZXF1ZXN0OiB7XG4gICAgICAgIHByaXZhdGVDaGFsbGVuZ2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgYW5zd2VyOiAnMTIzNDUnLFxuICAgICAgICB9LFxuICAgICAgICBjaGFsbGVuZ2VBbnN3ZXI6ICc1NDMyMScsXG4gICAgICB9LFxuICAgICAgcmVzcG9uc2U6IHtcbiAgICAgICAgYW5zd2VyQ29ycmVjdDogZmFsc2UsXG4gICAgICB9LFxuICAgICAgdXNlck5hbWU6ICd0ZXN0VXNlcicsXG4gICAgfTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGhhbmRsZXIoZXZlbnQpO1xuICAgIGV4cGVjdChyZXN1bHQucmVzcG9uc2UuYW5zd2VyQ29ycmVjdCkudG9CZShmYWxzZSk7XG4gIH0pO1xufSk7XG4iXX0=