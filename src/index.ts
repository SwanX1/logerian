import fs from 'fs';
import { formatWithOptions } from 'util';

export type PrefixPredicate = (level: LoggerLevel, identifier?: string | symbol) => string;
export type FilterPredicate = (data: string | Uint8Array, ansiFreeData: string | Uint8Array) => boolean;

export interface LoggerOutput {
  stream: { write: NodeJS.WritableStream['write'] } | Logger;
  level?: LoggerLevel;
  prefix?: PrefixPredicate;
  filter?: FilterPredicate;
}

export interface LoggerOptions {
  identifier: string | symbol;
  identifierPrefix?: PrefixPredicate;
  streams: LoggerOutput[];
}

export enum LoggerLevel {
  DEBUG = 0,
  INFO  = 1,
  WARN  = 2,
  ERROR = 3,
  FATAL = 4,
}

export function getLoggerLevelName(level: LoggerLevel): 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL' {
  if (level == LoggerLevel.DEBUG || level < 0) return 'DEBUG';
  if (level == LoggerLevel.INFO) return 'INFO';
  if (level == LoggerLevel.WARN) return 'WARN';
  if (level == LoggerLevel.ERROR) return 'ERROR';
  if (level == LoggerLevel.FATAL || level > 4) return 'FATAL';
  return 'INFO';
}

export function coloredIdentifier(identifierColor = 0, bracketColor = 0): PrefixPredicate {
  return (_level: LoggerLevel, identifier?: string | symbol): string => {
    if (identifier == null) return '';
    if (typeof identifier === 'symbol') {
      identifier = identifier.toString();
    }
    return `\x1b[${bracketColor}m[\x1b[0m\x1b[${identifierColor}m${identifier}\x1b[${bracketColor}m]\x1b[0m`;
  }
}

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
        level: LoggerLevel.INFO,
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

  public get identifier(): string | symbol {
    return this.options.identifier;
  }

  public addOutput(output: LoggerOutput): this {
    this.outputs.push(output);
    return this;
  }

  public removeOutput(outputStream: LoggerOutput['stream']): this {
    this.outputs = this.outputs.filter(output => output.stream !== outputStream);
    return this;
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  public log(...data: any[]): void {
    this.internalLog(LoggerLevel.INFO, ...data);
  }

  public debug(...data: any[]): void {
    this.internalLog(LoggerLevel.DEBUG, ...data);
  }

  public info(...data: any[]): void {
    this.internalLog(LoggerLevel.INFO, ...data);
  }

  public warn(...data: any[]): void {
    this.internalLog(LoggerLevel.WARN, ...data);
  }

  public error(...data: any[]): void {
    this.internalLog(LoggerLevel.ERROR, ...data);
  }

  public fatal(...data: any[]): void {
    this.internalLog(LoggerLevel.FATAL, ...data);
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected internalLog(level: LoggerLevel, ...data: any[]): void {
    for (const output of this.outputs) {
      if ((output.level ?? LoggerLevel.INFO) <= level) {
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