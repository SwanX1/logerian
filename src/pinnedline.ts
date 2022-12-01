import { LoggerLevel } from './level';
import { Logger } from './logger';

/**
 * This interface is used for internal use only.
 */
export interface PinnedLineOptions {
  level: keyof typeof LoggerLevel;
}

export class PinnedLine {
  private parent: Logger;
  private content?: string;
  private level: keyof typeof LoggerLevel;

  public constructor(parent: Logger, options: PinnedLineOptions) {
    this.parent = parent;
    this.level = options.level;
  }

  /**
   * Alias to {@link Logger.releasePinnedLine(line)}
   */
  public release(): boolean {
    return this.parent.releasePinnedLine(this);
  }

  /**
   * Alias to {@link Logger.isPinnedLineBound(line)}
   */
  public bound(): boolean {
    return this.parent.isPinnedLineBound(this);
  }

  public getLevel(): keyof typeof LoggerLevel {
    return this.level;
  }

  public getContent(): string {
    return this.content ?? '';
  }

  public setContent(message: string): this {
    if (!this.parent.isPinnedLineBound(this)) {
      return this;
    }

    this.content = message;
    this.parent.updatePinnedLines();
    return this;
  }
}
