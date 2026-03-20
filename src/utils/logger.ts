import os from "os";

const LEVEL_VALUES = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
} as const;

type Level = keyof typeof LEVEL_VALUES;

const DEFAULT_LEVEL: Level = "info";

function resolveLevel(value?: string): Level {
  if (!value) return DEFAULT_LEVEL;
  const v = value.toLowerCase();
  return (v in LEVEL_VALUES ? v : DEFAULT_LEVEL) as Level;
}

const currentLevel = resolveLevel(process.env.LOG_LEVEL);
const currentLevelValue = LEVEL_VALUES[currentLevel];

const isProd = process.env.NODE_ENV === "production";

const baseContext = {
  service: process.env.SERVICE_NAME || "app",
  env: process.env.NODE_ENV || "development",
  hostname: os.hostname(),
  pid: process.pid,
};

function serializeError(err: unknown): { type: string; message: string; stack: string; [key: string]: unknown } {
  if (err instanceof Error) {
    return {
      type: err.name,
      message: err.message,
      stack: err.stack ?? "",
    };
  }
  return {
    type: "UnknownError",
    message: String(err),
    stack: "",
  };
}

function now() {
  return new Date().toISOString();
}

function write(
  level: Level,
  arg: string | Record<string, unknown> | Error,
  msg?: string,
  context: Record<string, unknown> = {}
): void {
  if (LEVEL_VALUES[level] < currentLevelValue) return;

  let entry: Record<string, unknown>;

  if (arg instanceof Error) {
    entry = {
      err: serializeError(arg),
      ...(msg ? { msg } : {}),
    };
  } else if (typeof arg === "string") {
    entry = { msg: arg };
  } else {
    entry = { ...arg, ...(msg ? { msg } : {}) };
  }

  const log = {
    level,
    time: now(),
    ...baseContext,
    ...context,
    ...entry,
  };

  const output = isProd
    ? JSON.stringify(log)
    : prettyPrint(log);

  const stream =
    level === "error" || level === "warn"
      ? process.stderr
      : process.stdout;

  stream.write(output + "\n");
}

function prettyPrint(log: Record<string, any>) {
  const { level, time, msg, ...rest } = log;

  return `[${time}] ${level.toUpperCase()} ${
    msg || ""
  } ${Object.keys(rest).length ? JSON.stringify(rest, null, 2) : ""}`;
}

function createLogger(context: Record<string, unknown> = {}) {
  return {
    debug: (arg: any, msg?: string) => write("debug", arg, msg, context),
    info: (arg: any, msg?: string) => write("info", arg, msg, context),
    warn: (arg: any, msg?: string) => write("warn", arg, msg, context),
    error: (arg: any, msg?: string) => write("error", arg, msg, context),

    child: (childContext: Record<string, unknown>) =>
      createLogger({ ...context, ...childContext }),
  };
}

export const logger = createLogger();

export const fastifyLoggerOptions = {
  level: currentLevel,
  ...(isProd
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      }),
  serializers: {
    req(req: { method: string; url: string; id?: string }) {
      return {
        method: req.method,
        url: req.url,
        requestId: req.id,
      };
    },
    res(res: { statusCode: number }) {
      return { statusCode: res.statusCode };
    },
    err(err: Error) {
      return serializeError(err);
    },
  },
};
