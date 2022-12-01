import { addLoggerLevel, LoggerLevel, LoggerLevelData } from './level';
import { Logger, LoggerOptions, LoggerStream } from './logger';
import { PinnedLine } from './pinnedline';
import { coloredLog, stripANSIFormatting } from './util';

const util = {
  addLoggerLevel,
  coloredLog,
  stripANSIFormatting,
};

export { Logger, LoggerOptions, LoggerStream, LoggerLevel, LoggerLevelData, PinnedLine, util };
