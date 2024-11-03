import * as cliProgress from 'cli-progress';
import * as chalk from 'chalk';

export class DeployProgress {
  private bar: cliProgress.MultiBar;
  private progress: cliProgress.SingleBar;
  private steps: string[];
  private currentStep: number;

  constructor(steps: string[]) {
    this.steps = steps;
    this.currentStep = 0;
    this.bar = new cliProgress.MultiBar(
      {
        clearOnComplete: false,
        hideCursor: true,
        format: this.getProgressFormat(),
      },
      cliProgress.Presets.shades_classic
    );

    this.progress = this.bar.create(steps.length, 0, {});
    this.updateProgress();
  }

  private getProgressFormat(): string {
    return `${chalk.cyan('{bar}')} {percentage}% | {step} | {status}`;
  }

  next(status: string = ''): void {
    this.currentStep++;
    this.updateProgress(status);
  }

  updateCurrentStep(status: string): void {
    this.updateProgress(status);
  }

  private updateProgress(status: string = ''): void {
    this.progress.update(this.currentStep, {
      step: this.steps[this.currentStep] || 'Complete',
      status: status,
    });
  }

  complete(): void {
    this.bar.stop();
  }
}
