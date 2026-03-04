export interface PipelineStageLog {
  stage: string;
  duration_ms: number;
  count?: number;
  source?: string;
  error?: string;
}

/**
 * Structured timing logger for the feed pipeline.
 * Tracks per-stage duration and outputs a single log line per request.
 */
export class PipelineTimer {
  private stages: PipelineStageLog[] = [];
  private startTime: number;
  private currentStage: { name: string; start: number } | null = null;

  constructor(private userId: string) {
    this.startTime = Date.now();
  }

  start(stageName: string) {
    this.currentStage = { name: stageName, start: Date.now() };
  }

  end(extra?: { count?: number; source?: string; error?: string }) {
    if (!this.currentStage) return;
    this.stages.push({
      stage: this.currentStage.name,
      duration_ms: Date.now() - this.currentStage.start,
      ...extra,
    });
    this.currentStage = null;
  }

  finish(): { total_ms: number; stages: PipelineStageLog[]; userId: string } {
    return {
      userId: this.userId,
      total_ms: Date.now() - this.startTime,
      stages: this.stages,
    };
  }

  log() {
    const result = this.finish();
    const stageStr = result.stages
      .map(
        (s) =>
          `${s.stage}=${s.duration_ms}ms${s.count !== undefined ? `(${s.count})` : ''}${s.source ? `[${s.source}]` : ''}${s.error ? '[ERR]' : ''}`
      )
      .join(' → ');
    console.log(
      `[Feed Pipeline] user=${this.userId.substring(0, 8)} total=${result.total_ms}ms | ${stageStr}`
    );
    return result;
  }
}
