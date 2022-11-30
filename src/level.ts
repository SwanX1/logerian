export interface LoggerLevelData {
  /**
   * How "important" this level is. The higher the number, the more important.
   * Debug is 0, fatal is 4.
   */
  importance: number;
  /**
   * Optional formatting information about this level.
   */
  formatting?: {
    /**
     * The color of this logger level.
     * See: [ANSI escape codes](https://en.wikipedia.org/wiki/ANSI_escape_code#Colors).
     * @default 34
     */
    ansiColor: number;
  };
}

// Utility cache map for faster performance.
export const levelsByImportance: Map<number, string> = new Map();
export const LoggerLevel: Record<string, LoggerLevelData> = {};

export function addLoggerLevel(identifier: string, data: LoggerLevelData): LoggerLevelData {
  //#region Type checking
  if (typeof identifier !== 'string') {
    throw new TypeError('identifier must be a string');
  }
  if (typeof data.importance !== 'number') {
    throw new TypeError('data.importance must be a number');
  }
  if (!['undefined', 'object'].includes(typeof data.formatting)) {
    throw new TypeError('data.formatting must be undefined or an object');
  }
  if (typeof data.formatting !== 'undefined' && typeof data.formatting.ansiColor !== 'number') {
    throw new TypeError('data.formatting.ansiColor must be a number');
  }
  //#endregion

  identifier = identifier.toUpperCase();
  if (identifier in LoggerLevel) {
    throw new Error(`Logger level ${identifier} already exists!`);
  }
  if (levelsByImportance.has(data.importance)) {
    throw new Error(`There's already a logger level of importance ${data.importance}!`);
  }

  if (typeof data.formatting === 'undefined') {
    data.formatting = { ansiColor: 34 };
  }

  LoggerLevel[identifier] = data;
  levelsByImportance.set(data.importance, identifier);
  return data;
}

//#region Default levels
addLoggerLevel('DEBUG', {
  importance: 0,
  formatting: {
    ansiColor: 34,
  },
});
addLoggerLevel('INFO', {
  importance: 1,
  formatting: {
    ansiColor: 32,
  },
});
addLoggerLevel('WARN', {
  importance: 2,
  formatting: {
    ansiColor: 33,
  },
});
addLoggerLevel('ERROR', {
  importance: 3,
  formatting: {
    ansiColor: 31,
  },
});
addLoggerLevel('FATAL', {
  importance: 4,
  formatting: {
    ansiColor: 31,
  },
});
addLoggerLevel('NONE', {
  importance: Number.MAX_VALUE,
});
//#endregion
