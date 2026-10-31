import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import path from "node:path";
import readline from "node:readline";
import type { Readable, Writable } from "node:stream";

import type { RateLimitSnapshot } from "@/lib/codex/rate-limits";

type RpcResponse = {
  id?: number;
  result?: unknown;
  error?: { code?: number };
  method?: string;
  params?: unknown;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

export class JsonRpcConnection extends EventEmitter {
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly lines: readline.Interface;

  constructor(
    input: Readable,
    private readonly output: Writable,
  ) {
    super();
    this.lines = readline.createInterface({ input });
    this.lines.on("line", (line) => this.handleLine(line));
    this.lines.on("close", () => this.rejectPending("Codex App Server connection closed"));
  }

  async initialize() {
    await this.request("initialize", {
      clientInfo: {
        name: "ai_usage_monitor",
        title: "AI Usage Monitor",
        version: "0.1.0",
      },
    });
    this.notify("initialized", {});
  }

  request<T = unknown>(method: string, params: unknown = {}): Promise<T> {
    const id = this.nextId++;
    const promise = new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
    });
    this.write({ method, id, params });
    return promise;
  }

  notify(method: string, params: unknown) {
    this.write({ method, params });
  }

  close() {
    this.lines.close();
    this.output.end();
    this.rejectPending("Codex App Server connection closed");
  }

  private handleLine(line: string) {
    let message: RpcResponse;
    try {
      message = JSON.parse(line) as RpcResponse;
    } catch {
      return;
    }

    if (typeof message.id === "number") {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(
          new Error(`Codex App Server request failed (${message.error.code ?? "unknown"})`),
        );
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.method) this.emit(message.method, message.params);
  }

  private write(message: object) {
    this.output.write(`${JSON.stringify(message)}\n`);
  }

  private rejectPending(message: string) {
    for (const request of this.pending.values()) request.reject(new Error(message));
    this.pending.clear();
  }
}

export type ChatGptAccount = {
  type: "chatgpt";
  email: string | null;
  planType: string | null;
};

export type DeviceLogin = {
  type: "chatgptDeviceCode";
  loginId: string;
  verificationUrl: string;
  userCode: string;
};

export type RateLimitsResponse = {
  rateLimits: RateLimitSnapshot | null;
  rateLimitsByLimitId?: Record<string, RateLimitSnapshot>;
};

export class CodexAppServerClient {
  private constructor(
    private readonly child: ChildProcessWithoutNullStreams,
    readonly connection: JsonRpcConnection,
  ) {}

  static async start(codexHome: string) {
    const executable =
      process.env.CODEX_BIN ??
      path.join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "codex.cmd" : "codex");
    const child = spawn(/* turbopackIgnore: true */ executable, ["app-server"], {
      env: { ...process.env, CODEX_HOME: codexHome },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const connection = new JsonRpcConnection(child.stdout, child.stdin);
    child.on("error", (error) => connection.emit("process/error", error));
    await connection.initialize();
    return new CodexAppServerClient(child, connection);
  }

  readAccount() {
    return this.connection.request<{
      account: ChatGptAccount | null;
      requiresOpenaiAuth: boolean;
    }>("account/read", { refreshToken: false });
  }

  readRateLimits() {
    return this.connection.request<RateLimitsResponse>("account/rateLimits/read");
  }

  startDeviceLogin() {
    return this.connection.request<DeviceLogin>("account/login/start", {
      type: "chatgptDeviceCode",
    });
  }

  close() {
    this.connection.close();
    this.child.kill();
  }
}
