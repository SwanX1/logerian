import fs from 'fs';
import { formatWithOptions } from 'util';

export type PrefixPredicate = (level: LoggerLevel, identifier?: string | symbol) => string;
export type FilterPredicate = (data: string | Uint8Array, ansiFreeData: string | Uint8Array) => boolean;

export interface LoggerOutput {
  /**
   * Stream that will be used to output the log messages.
   * If the stream is a {@link Logger} instance, the output will be logged to the stream. without filtering and without a prefix.
   */
  stream: Pick<NodeJS.WritableStream, 'write'> | Logger;
  /**
   * Determines the verbosity of the output.
   * If the stream is a {@link Logger} instance, this value will be used.
   */
  level?: LoggerLevel;
  /**
   * The prefix predicate that will be used to format the log message.
   * If the stream is a {@link Logger} instance, this value will not be used.
   */
  prefix?: PrefixPredicate;
  /**
   * This predicate will be used to filter log messages. If the function returns true, the message will be logged.
   * If the stream is a {@link Logger} instance, this value will not be used.
   */
  filter?: FilterPredicate;
}

export interface LoggerOptions {
  /**
   * Used for heirarchical logging. The identifier will be passed on to the identifier prefix function.
   */
  identifier: string | symbol;
  /**
   * Used for heirarchical logging. This determines the prefix added to the log message before passing it on to the parent logger.
   */
  identifierPrefix?: PrefixPredicate;
  /**
   * Determines the outputs that will be used to log the messages. Duplicate streams will be filtered out.
   */
  streams: LoggerOutput[];
}

/**
 * LoggerLevels are used to determine the verbosity of logger outputs.
 */
export enum LoggerLevel {
  DEBUG = 0,
  INFO  = 1,
  WARN  = 2,
  ERROR = 3,
  FATAL = 4,
}

/**
 * Converts a LoggerLevel to a string.
 */
export function getLoggerLevelName(level: LoggerLevel): 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL' {
  if (level == LoggerLevel.DEBUG || level < 0) return 'DEBUG';
  if (level == LoggerLevel.INFO) return 'INFO';
  if (level == LoggerLevel.WARN) return 'WARN';
  if (level == LoggerLevel.ERROR) return 'ERROR';
  if (level == LoggerLevel.FATAL || level > 4) return 'FATAL';
  return 'INFO';
}

/**
 * Returns a colored identifier prefix predicate.
 * @param identifierColor The color to use for the identifier. Accepts [ANSI escape codes](https://en.wikipedia.org/wiki/ANSI_escape_code#Colors).
 * @param bracketColor The color to use for the brackets. Accepts [ANSI escape codes](https://en.wikipedia.org/wiki/ANSI_escape_code#Colors).
 */
export function coloredIdentifier(identifierColor = 0, bracketColor = 0): PrefixPredicate {
  return (_level: LoggerLevel, identifier?: string | symbol): string => {
    if (identifier == null) return '';
    if (typeof identifier === 'symbol') {
      identifier = identifier.toString();
    }
    return `\x1b[${bracketColor}m[\x1b[0m\x1b[${identifierColor}m${identifier}\x1b[${bracketColor}m]\x1b[0m`;
  }
}

/**
 * Returns a colored prefix string.
 */
export function coloredLog(level: LoggerLevel): string {
  const date: Date = new Date();
  let loglevelcolor: number;
  switch (level) {
    case LoggerLevel.DEBUG:
      loglevelcolor = 34;
      break;
    case LoggerLevel.INFO:
      loglevelcolor = 32;
      break;
    case LoggerLevel.WARN:
      loglevelcolor = 33;
      break;
    case LoggerLevel.ERROR:
      loglevelcolor = 31;
      break;
    case LoggerLevel.FATAL:
      loglevelcolor = 31;
      break;
  }

  return `\x1b[90m[${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}]\x1b[39m \x1b[${loglevelcolor}m${`[${getLoggerLevelName(level)}]`.padEnd(7, ' ')}\x1b[39m `;
}

export class Logger {
  static defaultOptions: LoggerOptions = {
    identifier: Symbol('Unnamed'),
    streams: [
      {
        stream: process.stdout,
        level: LoggerLevel.DEBUG,
        prefix: (): string => `[${new Date().toLocaleTimeString()}] `
      }
    ],
  };

  private options: LoggerOptions;
  private outputs: LoggerOutput[];

  constructor(options?: Partial<LoggerOptions>) {
    this.options = {
      ...Logger.defaultOptions,
      ...options,
    };
    this.outputs = [];
    for (const output of this.options.streams) {
      this.addOutput(output);
    }
  }

  /**
   * @default Symbol('Unnamed')
   */
  public get identifier(): string | symbol {
    return this.options.identifier;
  }

  /**
   * Adds a new output stream to the logger. If the exact same output stream is already added, it will be ignored.
   */
  public addOutput(output: LoggerOutput): this {
    if (!this.outputs.some(o => o.stream === output.stream || ('write' in o.stream && 'write' in output.stream && o.stream.write === output.stream.write))) {
      this.outputs.push(output);
    }
    return this;
  }

  /**
   * Removes an output stream from the logger.
   */
  public removeOutput(outputStream: LoggerOutput['stream']): this {
    this.outputs = this.outputs.filter(output => output.stream !== outputStream);
    return this;
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  /**
   * Shorthand for {@link Logger.info()}
   */
  public log(...data: any[]): void {
    this.internalLog(LoggerLevel.INFO, ...data);
  }

  /**
   * Logs a message with log level {@link LoggerLevel.DEBUG}
   */
  public debug(...data: any[]): void {
    this.internalLog(LoggerLevel.DEBUG, ...data);
  }

  /**
   * Logs a message with log level {@link LoggerLevel.INFO}
   */
  public info(...data: any[]): void {
    this.internalLog(LoggerLevel.INFO, ...data);
  }

  /**
   * Logs a message with log level {@link LoggerLevel.WARN}
   */
  public warn(...data: any[]): void {
    this.internalLog(LoggerLevel.WARN, ...data);
  }

  /**
   * Logs a message with log level {@link LoggerLevel.ERROR}
   */
  public error(...data: any[]): void {
    this.internalLog(LoggerLevel.ERROR, ...data);
  }

  /**
   * Logs a message with log level {@link LoggerLevel.FATAL}
   */
  public fatal(...data: any[]): void {
    this.internalLog(LoggerLevel.FATAL, ...data);
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  /**
   * This is an internal method that logs a message with the given log level.
   * It will only log the message if the log level is greater than or equal to the level of the output.
   * @private
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected internalLog(level: LoggerLevel, ...data: any[]): void {
    for (const output of this.outputs) {
      if ((output.level ?? LoggerLevel.DEBUG) <= level) {
        if (output.stream instanceof Logger) {
          if (this.options.identifierPrefix) {
            output.stream.internalLog(level, this.options.identifierPrefix(level, this.options.identifier), ...data);
          } else {
            output.stream.internalLog(level, ...data);
          }
        } else {
          let s = '';
          if (typeof output.prefix === 'function') {
            s += output.prefix(level);
          }
  
          s += formatWithOptions.apply(this, [{ colors: true }, ...data]);
          // Remove ansi codes
          let sStripped = s.replace(
            // eslint-disable-next-line no-control-regex
            /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]))/g,
            ''
            );
          if (typeof output.filter === 'function' && !output.filter(s, sStripped)) continue;
          s += '\n';
          sStripped += '\n';
          if (output.stream instanceof fs.WriteStream) {
            output.stream.write(sStripped);
          } else {
            output.stream.write(s);
          }
        }
      }
    }
  }
}