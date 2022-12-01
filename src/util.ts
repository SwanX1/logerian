import { LoggerLevel, LoggerLevelData } from './level';

/**
 * Returns a colored prefix string.
 */
export function coloredLog(levelName: string): string {
  const date: Date = new Date();
  if (typeof levelName === 'undefined') {
    throw new Error('Invalid importance value!');
  }
  const level: LoggerLevelData = LoggerLevel[levelName];

  return `\x1b[90m[${date.getHours().toString().padStart(2, '0')}:${date
    .getMinutes()
    .toString()
    .padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}]\x1b[39m \x1b[${
    level.formatting?.ansiColor ?? 34
  }m${`[${levelName}]`.padEnd(7, ' ')}\x1b[39m `;
}

export function stripANSIFormatting(string: string): string {
  return string.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]))/g,
    ''
  );
}
