<h1 align="center">Logerian</h1>

### Description
Logerian is a logging utility made by [me](https://github.com/SwanX1)!
I made this logging utility mainly because I am too dumb to understand other loggers like [winston](https://www.npmjs.com/package/winston) and [signale](https://www.npmjs.com/package/signale).
If you're willing to contribute, please read [CONTRIBUTING.md](./CONTRIBUTING.md).

### Usage
To use this logger, you can simply just create a new logger instance and it'll work:
```typescript
import { Logger } from "logerian"; // ES import
const { Logger } = require("logerian"); // CJS import

const logger = new Logger();

logger.log("Hello World!");
// Output: [17:43:01] Hello World!
```

By default, the logger creates a stream with a timestamp as shown in the example code above.
If you wish to change that, you'll have to define a stream when you create the logger.
```typescript
const logger = new Logger({
  streams: [
    {
      stream: process.stdout,
    },
  ],
});

logger.log("foobar");
// Output: foobar
```

A logger can utilize multiple output streams:
```typescript
const logger = new Logger({
  streams: [
    {
      stream: process.stdout,
    },
    {
      stream: fs.createWriteStream("log.txt"),
    },
  ],
});

logger.log("Iron Man dies in Endgame");
// Output: Iron Man dies in Endgame
logger.log("Steve Rogers is old!!");
// Output: Steve Rogers is old!!
```
```conf
# log.txt
Iron Man dies in Endgame
Steve Rogers is old!!
```

There's also a neat thing called log levels!
```typescript
import { Logger, LoggerLevel } from "logerian";
const { Logger, LoggerLevel } = require("logerian");

const logger = new Logger({
  streams: [
    {
      level: LoggerLevel.WARN,
      stream: process.stdout,
    },
    {
      level: LoggerLevel.DEBUG, // Debug level is default
      stream: fs.createWriteStream("log.txt"),
    }
  ],
});

// Logs to both - stdout and log.txt
logger.error("Uh oh! There's an error!");

// Logs only to log.txt
logger.debug("By the way, there's an error because your code sucks!");
```

For further information, read the [JSDocs](https://cernavskis.dev/docs/logerian).