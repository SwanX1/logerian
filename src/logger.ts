import fs from 'fs';
import tty from 'tty';
import { formatWithOptions } from 'util';
import { LoggerLevel } from './level';
import { PinnedLine } from './pinnedline';
import { coloredLog, stripANSIFormatting } from './util';

interface DeterminedLoggerStream<
  StreamType extends Pick<NodeJS.WritableStream, 'write'> | Logger = Pick<NodeJS.WritableStream, 'write'> | Logger
> extends LoggerStream<StreamType> {
  level: (importance: number) => boolean;
  prefix: (level: keyof typeof LoggerLevel) => string;
  allowPinnedLines: boolean;
}

export interface LoggerStream<
  StreamType extends Pick<NodeJS.WritableStream, 'write'> | Logger = Pick<NodeJS.WritableStream, 'write'> | Logger
> {
  /**
   * Stream that will be used to output the log messages.
   * If the stream is a {@link Logger} instance, the output will be logged to the stream. without filtering and without a prefix.
   */
  stream: StreamType;

  /**
   * Determines the verbosity of the output.
   * @example
   * ```js
   * options = {
   *   level: (importance) => importance >= 1 && importance <= 2, // Importance values between INFO and WARN
   * };
   *
   * logger.debug("Some really detailed information");
   * // No output.
   * logger.info("Something just happened!");
   * // -> Something just happened!
   * logger.warn("This should be fixed though...");
   * // -> This should be fixed though
   * logger.error("Something went horribly wrong!!!");
   * // No output.
   * ```
   */
  level?: keyof typeof LoggerLevel | number | ((importance: number) => boolean);

  /**
   * The prefix function that will be used to format the log message.
   *
   * This is applied after {@link interceptString} is called.
   *
   * If the {@link stream} is a {@link Logger} instance, this function will not be called.
   */
  prefix?: (level: keyof typeof LoggerLevel) => string;

  /**
   * Whether or not to write pinned lines to this stream.
   * @default true
   */
  allowPinnedLines?: boolean;

  /**
   * This function will be used to intercept and possibly modify log data.
   *
   * If the function returns X, then the log data will Y:
   *  - undefined - the log message will be logged as normal.
   *    This does the same thing as returning the unmodified data array.
   *  - array - will be replaced with the returned data.
   *    The returned array will not be intercepted again, the formatted message, however, will.
   *  - null - will not be logged at all
   * @example
   * ```js
   * options = {
   *  intercept: (data) => {
   *    if (data[0] instanceof Error) {
   *      return ["Intercepted Error: " + data[0].message];
   *    }
   *  }
   * };
   *
   * logger.log([1, 2]);
   * // => [1, 2]
   * logger.log(new Error("Test Error"));
   * // => Intercepted Error: Test Error
   * ```
   */
  interceptData?: (data: unknown[], level: keyof typeof LoggerLevel) => undefined | null | unknown[];

  /**
   * This function will be used to intercept and possibly modify log messages.
   *
   * This is different than {@link interceptData}, because the logger will format the log data first and then pass the resulting string to this.
   *
   * If the function returns X, then the log message will Y:
   *  - undefined - the log message will be logged as normal.
   *    This does the same thing as returning the unmodified string.
   *  - string - will be replaced with the returned string.
   *    The returned array will not be intercepted again.
   *  - null - will not be logged at all
   */
  interceptString?: (data: string, level: keyof typeof LoggerLevel) => undefined | null | string;
}

export interface LoggerOptions {
  /** Defaults to stdout with the default logger prefix from {@link coloredLog}. */
  streams?: LoggerStream | LoggerStream[];

  /**
   * This string will be prepended to the log message before passing it to the parent logger.
   * This value will be used only if the output stream is a {@link Logger} instance.
   */
  identifier?: string;
}

export class Logger {
  private streams: DeterminedLoggerStream[];
  private identifier?: string;
  // We can safely use Set here, because sets in javascript are ordered.
  private pinnedLines: Set<PinnedLine> = new Set();

  public constructor(options: LoggerOptions = {}) {
    this.streams = (
      options.streams
        ? Array.isArray(options.streams)
          ? options.streams
          : [options.streams]
        : ([
            {
              stream: process.stdout,
            },
          ] satisfies LoggerStream[])
    ).map(stream => {
      const prefix = stream.prefix ?? coloredLog;
      let level = stream.level ?? 'DEBUG';
      if (typeof level === 'string') {
        level = LoggerLevel[level].importance;
      }
      let levelFunc = level;
      if (typeof level === 'number') {
        levelFunc = (importance: number) => importance >= level;
      }
      return {
        level: levelFunc as (importance: number) => boolean,
        prefix,
        allowPinnedLines: stream.allowPinnedLines ?? true,
        stream: stream.stream,
        interceptData: stream.interceptData,
        interceptString: stream.interceptString,
      };
    });

    this.identifier = options.identifier;
  }

  /**
   * Adds a new output stream to the logger. If the exact same stream is already added, it will be ignored.
   */
  public addStream(stream: LoggerStream): this {
    if (!(this.streams as LoggerStream[]).includes(stream)) {
      (this.streams as LoggerStream[]).push(stream);
    }
    return this;
  }
  /**
   * Removes a stream (note: the actual stream instead of the object) from the logger.
   */
  public removeOutput(outputStream: LoggerStream['stream']): this {
    this.streams = this.streams.filter(stream => stream.stream !== outputStream);
    return this;
  }

  /**
   * Logs a message with log level {@link LoggerLevel.DEBUG}
   */
  public debug(...data: unknown[]): void {
    this.log('DEBUG', ...data);
  }

  /**
   * Logs a message with log level {@link LoggerLevel.INFO}
   */
  public info(...data: unknown[]): void {
    this.log('INFO', ...data);
  }

  /**
   * Logs a message with log level {@link LoggerLevel.WARN}
   */
  public warn(...data: unknown[]): void {
    this.log('WARN', ...data);
  }

  /**
   * Logs a message with log level {@link LoggerLevel.ERROR}
   */
  public error(...data: unknown[]): void {
    this.log('ERROR', ...data);
  }

  /**
   * Logs a message with log level {@link LoggerLevel.FATAL}
   */
  public fatal(...data: unknown[]): void {
    this.log('FATAL', ...data);
  }

  /**
   * Logs a message with the given log level
   */
  public log(level: keyof typeof LoggerLevel, ...data: unknown[]): void {
    for (const stream of this.streams) {
      if (stream.level(LoggerLevel[level].importance)) {
        if (typeof stream.interceptData === 'function') {
          const interceptModified = stream.interceptData.apply(this, [data, level]);
          if (Array.isArray(interceptModified)) {
            data = interceptModified;
          } else if (interceptModified === null) {
            continue;
          } else if (typeof interceptModified !== 'undefined') {
            throw new TypeError('interceptData returned an invalid type');
          }
        }
      }

      this.logData(stream, level, data);
    }
  }

  private logData(stream: DeterminedLoggerStream, level: keyof typeof LoggerLevel, data: unknown[]): void {
    const message = this.dataToMessage(stream, level, data);

    if (message === null) {
      return;
    }

    if (stream.stream instanceof Logger) {
      stream.stream.log(level, message);
    } else {
      this.writeToStream(stream, level, message + '\n');
    }
  }

  private dataToMessage(
    stream: DeterminedLoggerStream,
    level: keyof typeof LoggerLevel,
    data: unknown[]
  ): string | null {
    let message = formatWithOptions.apply(this, [{ colors: true }, ...data]);
    if (typeof stream.interceptString === 'function') {
      const interceptModified = stream.interceptString.apply(this, [message, level]);
      if (typeof interceptModified === 'string') {
        message = interceptModified;
      } else if (interceptModified === null) {
        return null;
      } else if (typeof interceptModified !== 'undefined') {
        throw new TypeError('interceptString returned an invalid type');
      }
    }

    if (stream.stream instanceof Logger) {
      if (typeof this.identifier === 'string') {
        message = message
          .split('\n')
          .map(line => this.identifier + ' ' + line)
          .join('\n');
      }
      return message;
    }

    if (typeof stream.prefix === 'function') {
      const prefix = stream.prefix.apply(this, [level]);
      message = message
        .split('\n')
        .map(line => prefix + line)
        .join('\n');
    }

    if (stream.stream instanceof fs.WriteStream) {
      message = stripANSIFormatting(message);
    }

    return message;
  }

  private writeToStream(stream: DeterminedLoggerStream, level: string, data: string): void {
    if (stream.stream instanceof Logger) {
      stream.stream.log(level, data);
      return;
    }
    if (!(stream.stream instanceof tty.WriteStream && stream.allowPinnedLines)) {
      stream.stream.write(data);
      return;
    }
    this.writePinnedLines(stream as DeterminedLoggerStream<tty.WriteStream>, data);
  }

  /**
   * Creates a pinned line, which will always be at the bottom of the screen.
   *
   * Due to their nature, they cannot be logged to non-TTY streams.
   *
   * Pinned lines only work in top-level loggers, because loggers are not an implementation of a TTY stream.
   */
  public createPinnedLine(level: keyof typeof LoggerLevel, initialMessage?: string): PinnedLine {
    const line = new PinnedLine(this, { level });
    this.pinnedLines.add(line);
    if (typeof initialMessage === 'string') {
      line.setContent(initialMessage);
    } else {
      this.updatePinnedLines();
    }
    return line;
  }

  /**
   * Releases a pinned line, causing it to be logged as-is in its current state.
   * @returns If the line was not bound, and there was nothing to remove, the function returns false. Otherwise it returns true.
   */
  public releasePinnedLine(line: PinnedLine): boolean {
    if (this.isPinnedLineBound(line)) {
      this.pinnedLines.delete(line);
      this.log(line.getLevel(), line.getContent());
      return true;
    }
    return false;
  }

  /**
   * Forces an update for all pinned lines.
   */
  public updatePinnedLines() {
    for (const stream of this.streams) {
      if (!stream.allowPinnedLines) continue;
      if (stream.stream instanceof tty.WriteStream) {
        this.writePinnedLines(stream as DeterminedLoggerStream<tty.WriteStream>);
      }
    }
  }

  public isPinnedLineBound(line: PinnedLine): boolean {
    return this.pinnedLines.has(line);
  }

  private previousLineSize: Map<tty.WriteStream, number> = new Map();
  private async writePinnedLines(
    stream: DeterminedLoggerStream<tty.WriteStream>,
    contentAbove?: string
  ): Promise<void> {
    const writeStream = stream.stream;
    writeStream.moveCursor(0, -(this.previousLineSize.get(writeStream) ?? 0));
    this.previousLineSize.set(writeStream, this.pinnedLines.size);
    writeStream.cursorTo(0);
    writeStream.clearLine(0);

    if (contentAbove) {
      writeStream.write(contentAbove);
    }

    this.pinnedLines.forEach(line => {
      const level = line.getLevel();
      if (!stream.level(LoggerLevel[level].importance)) {
        return;
      }

      const message = this.dataToMessage(stream, line.getLevel(), [line.getContent()]);
      if (message === null) {
        return;
      }

      const content = message.split('\n', 1)[0].substring(0, writeStream.columns);

      writeStream.cursorTo(0);
      writeStream.clearLine(0);
      writeStream.write(content);
      writeStream.write('\n');
    });
  }
}
