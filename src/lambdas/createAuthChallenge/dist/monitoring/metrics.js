"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metrics = void 0;
const client_cloudwatch_1 = require("@aws-sdk/client-cloudwatch");
const cloudwatch = new client_cloudwatch_1.CloudWatch({ region: 'sa-east-1' });
exports.metrics = {
    async publish(metrics) {
        const metricData = metrics.map((metric) => ({
            MetricName: metric.name,
            Value: metric.value,
            Unit: metric.unit,
            Timestamp: new Date(),
        }));
        await cloudwatch.putMetricData({
            Namespace: 'Authentication',
            MetricData: metricData,
        });
    },
    async recordAuthAttempt(success, duration) {
        await this.publish([
            {
                name: 'AuthenticationDuration',
                value: duration,
                unit: client_cloudwatch_1.StandardUnit.Milliseconds,
            },
            {
                name: success ? 'SuccessfulAuthentications' : 'FailedAuthentications',
                value: 1,
                unit: client_cloudwatch_1.StandardUnit.Count,
            },
        ]);
    },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0cmljcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tb25pdG9yaW5nL21ldHJpY3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsa0VBSW9DO0FBRXBDLE1BQU0sVUFBVSxHQUFHLElBQUksOEJBQVUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsQ0FBQyxDQUFDO0FBUTlDLFFBQUEsT0FBTyxHQUFHO0lBQ3JCLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBcUI7UUFDakMsTUFBTSxVQUFVLEdBQWtCLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDekQsVUFBVSxFQUFFLE1BQU0sQ0FBQyxJQUFJO1lBQ3ZCLEtBQUssRUFBRSxNQUFNLENBQUMsS0FBSztZQUNuQixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUk7WUFDakIsU0FBUyxFQUFFLElBQUksSUFBSSxFQUFFO1NBQ3RCLENBQUMsQ0FBQyxDQUFDO1FBRUosTUFBTSxVQUFVLENBQUMsYUFBYSxDQUFDO1lBQzdCLFNBQVMsRUFBRSxnQkFBZ0I7WUFDM0IsVUFBVSxFQUFFLFVBQVU7U0FDdkIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxPQUFnQixFQUFFLFFBQWdCO1FBQ3hELE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQztZQUNqQjtnQkFDRSxJQUFJLEVBQUUsd0JBQXdCO2dCQUM5QixLQUFLLEVBQUUsUUFBUTtnQkFDZixJQUFJLEVBQUUsZ0NBQVksQ0FBQyxZQUFZO2FBQ2hDO1lBQ0Q7Z0JBQ0UsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsMkJBQTJCLENBQUMsQ0FBQyxDQUFDLHVCQUF1QjtnQkFDckUsS0FBSyxFQUFFLENBQUM7Z0JBQ1IsSUFBSSxFQUFFLGdDQUFZLENBQUMsS0FBSzthQUN6QjtTQUNGLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgQ2xvdWRXYXRjaCxcbiAgU3RhbmRhcmRVbml0LFxuICBNZXRyaWNEYXR1bSxcbn0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWNsb3Vkd2F0Y2gnO1xuXG5jb25zdCBjbG91ZHdhdGNoID0gbmV3IENsb3VkV2F0Y2goeyByZWdpb246ICdzYS1lYXN0LTEnIH0pO1xuXG5pbnRlcmZhY2UgTWV0cmljRGF0YSB7XG4gIG5hbWU6IHN0cmluZztcbiAgdmFsdWU6IG51bWJlcjtcbiAgdW5pdDogU3RhbmRhcmRVbml0O1xufVxuXG5leHBvcnQgY29uc3QgbWV0cmljcyA9IHtcbiAgYXN5bmMgcHVibGlzaChtZXRyaWNzOiBNZXRyaWNEYXRhW10pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBtZXRyaWNEYXRhOiBNZXRyaWNEYXR1bVtdID0gbWV0cmljcy5tYXAoKG1ldHJpYykgPT4gKHtcbiAgICAgIE1ldHJpY05hbWU6IG1ldHJpYy5uYW1lLFxuICAgICAgVmFsdWU6IG1ldHJpYy52YWx1ZSxcbiAgICAgIFVuaXQ6IG1ldHJpYy51bml0LFxuICAgICAgVGltZXN0YW1wOiBuZXcgRGF0ZSgpLFxuICAgIH0pKTtcblxuICAgIGF3YWl0IGNsb3Vkd2F0Y2gucHV0TWV0cmljRGF0YSh7XG4gICAgICBOYW1lc3BhY2U6ICdBdXRoZW50aWNhdGlvbicsXG4gICAgICBNZXRyaWNEYXRhOiBtZXRyaWNEYXRhLFxuICAgIH0pO1xuICB9LFxuXG4gIGFzeW5jIHJlY29yZEF1dGhBdHRlbXB0KHN1Y2Nlc3M6IGJvb2xlYW4sIGR1cmF0aW9uOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLnB1Ymxpc2goW1xuICAgICAge1xuICAgICAgICBuYW1lOiAnQXV0aGVudGljYXRpb25EdXJhdGlvbicsXG4gICAgICAgIHZhbHVlOiBkdXJhdGlvbixcbiAgICAgICAgdW5pdDogU3RhbmRhcmRVbml0Lk1pbGxpc2Vjb25kcyxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6IHN1Y2Nlc3MgPyAnU3VjY2Vzc2Z1bEF1dGhlbnRpY2F0aW9ucycgOiAnRmFpbGVkQXV0aGVudGljYXRpb25zJyxcbiAgICAgICAgdmFsdWU6IDEsXG4gICAgICAgIHVuaXQ6IFN0YW5kYXJkVW5pdC5Db3VudCxcbiAgICAgIH0sXG4gICAgXSk7XG4gIH0sXG59O1xuIl19