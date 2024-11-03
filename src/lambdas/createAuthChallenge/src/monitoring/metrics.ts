import {
  CloudWatch,
  StandardUnit,
  MetricDatum,
} from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatch({ region: 'sa-east-1' });

interface MetricData {
  name: string;
  value: number;
  unit: StandardUnit;
}

export const metrics = {
  async publish(metrics: MetricData[]): Promise<void> {
    const metricData: MetricDatum[] = metrics.map((metric) => ({
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

  async recordAuthAttempt(success: boolean, duration: number): Promise<void> {
    await this.publish([
      {
        name: 'AuthenticationDuration',
        value: duration,
        unit: StandardUnit.Milliseconds,
      },
      {
        name: success ? 'SuccessfulAuthentications' : 'FailedAuthentications',
        value: 1,
        unit: StandardUnit.Count,
      },
    ]);
  },
};
