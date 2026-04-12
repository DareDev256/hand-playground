// One Euro Filter — smooth noisy hand tracking signals
// Paper: http://cristal.univ-lille.fr/~casiez/1euro/

class LowPassFilter {
  private y: number | null = null;
  private s: number | null = null;

  filter(value: number, alpha: number): number {
    if (this.y === null) {
      this.s = value;
    } else {
      this.s = alpha * value + (1 - alpha) * this.s!;
    }
    this.y = value;
    return this.s!;
  }

  lastValue(): number {
    return this.y ?? 0;
  }

  hasLastValue(): boolean {
    return this.y !== null;
  }
}

export class OneEuroFilter {
  private freq: number;
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xFilter = new LowPassFilter();
  private dxFilter = new LowPassFilter();
  private lastTime: number | null = null;

  constructor(freq = 30, minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.freq = freq;
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private alpha(cutoff: number): number {
    const te = 1.0 / this.freq;
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / te);
  }

  filter(value: number, timestamp?: number): number {
    if (this.lastTime !== undefined && timestamp !== undefined && this.lastTime !== null) {
      this.freq = 1.0 / (timestamp - this.lastTime);
    }
    this.lastTime = timestamp ?? null;

    const dx = this.xFilter.hasLastValue()
      ? (value - this.xFilter.lastValue()) * this.freq
      : 0;
    const edx = this.dxFilter.filter(dx, this.alpha(this.dCutoff));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.xFilter.filter(value, this.alpha(cutoff));
  }

  reset() {
    this.xFilter = new LowPassFilter();
    this.dxFilter = new LowPassFilter();
    this.lastTime = null;
  }
}

export class Point2DFilter {
  private xFilter: OneEuroFilter;
  private yFilter: OneEuroFilter;

  constructor(freq = 30, minCutoff = 1.0, beta = 0.007) {
    this.xFilter = new OneEuroFilter(freq, minCutoff, beta);
    this.yFilter = new OneEuroFilter(freq, minCutoff, beta);
  }

  filter(x: number, y: number, timestamp?: number): { x: number; y: number } {
    return {
      x: this.xFilter.filter(x, timestamp),
      y: this.yFilter.filter(y, timestamp),
    };
  }

  reset() {
    this.xFilter.reset();
    this.yFilter.reset();
  }
}
