import { fallbackTokenCatalog } from "../data/tokens";
import type { TokenCatalogItem, TokenFeedStatus } from "../types";
import { PumpPortalClient } from "./pumpPortalClient";

const INITIAL_TIMEOUT_MS = 5000;

const mergeUniqueTokens = (current: TokenCatalogItem[], incoming: TokenCatalogItem, maxCatalogSize: number) => {
  const withoutDup = current.filter((item) => item.mint !== incoming.mint);
  return [incoming, ...withoutDup].slice(0, maxCatalogSize);
};

interface TokenSourceOptions {
  maxPerMinute: number;
  maxCatalogSize: number;
}

export class TokenSourceService {
  private client = new PumpPortalClient();
  private listeners = new Set<(tokens: TokenCatalogItem[]) => void>();
  private statusListeners = new Set<(status: TokenFeedStatus) => void>();
  private reconnectTimer: number | null = null;
  private fallbackTimer: number | null = null;
  private retryCount = 0;
  private tokens: TokenCatalogItem[] = fallbackTokenCatalog;
  private hasLiveData = false;
  private status: TokenFeedStatus = {
    connection: "connecting",
    source: "fallback",
    tokenCount: fallbackTokenCatalog.length,
    retryCount: 0,
    lastUpdatedAt: null,
  };
  private minuteWindowStartedAt = Date.now();
  private minuteAdds = 0;
  private options: TokenSourceOptions;

  constructor(options?: Partial<TokenSourceOptions>) {
    this.options = {
      maxPerMinute: Math.min(60, Math.max(5, Math.round(options?.maxPerMinute ?? 30))),
      maxCatalogSize: Math.min(50, Math.max(5, Math.round(options?.maxCatalogSize ?? 20))),
    };
  }

  start() {
    this.emit();

    const cleanupToken = this.client.onToken((item) => {
      const now = Date.now();
      if (now - this.minuteWindowStartedAt > 60_000) {
        this.minuteWindowStartedAt = now;
        this.minuteAdds = 0;
      }
      if (this.minuteAdds >= this.options.maxPerMinute) return;

      this.minuteAdds += 1;
      this.hasLiveData = true;
      this.retryCount = 0;
      this.tokens = mergeUniqueTokens(this.tokens, item, this.options.maxCatalogSize);
      this.status = {
        connection: "live",
        source: "pumpportal",
        tokenCount: this.tokens.length,
        retryCount: this.retryCount,
        lastUpdatedAt: Date.now(),
      };
      this.emit();
    });

    const cleanupOpen = this.client.onOpen(() => {
      this.clearFallbackTimer();
      this.scheduleFallbackTimer();
      this.status = {
        connection: "connecting",
        source: this.hasLiveData ? "pumpportal" : "fallback",
        tokenCount: this.tokens.length,
        retryCount: this.retryCount,
        lastUpdatedAt: this.status.lastUpdatedAt,
      };
      this.emitStatus();
    });

    const cleanupClose = this.client.onClose(() => {
      this.status = {
        connection: this.hasLiveData ? "reconnecting" : "fallback",
        source: this.hasLiveData ? "pumpportal" : "fallback",
        tokenCount: this.tokens.length,
        retryCount: this.retryCount,
        lastUpdatedAt: this.status.lastUpdatedAt,
      };
      this.emitStatus();
      this.scheduleReconnect();
    });

    this.scheduleFallbackTimer();
    this.client.connect();

    return () => {
      cleanupToken();
      cleanupOpen();
      cleanupClose();
      this.stop();
    };
  }

  subscribe(listener: (tokens: TokenCatalogItem[]) => void) {
    this.listeners.add(listener);
    listener(this.tokens);
    return () => this.listeners.delete(listener);
  }

  subscribeStatus(listener: (status: TokenFeedStatus) => void) {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  stop() {
    this.clearFallbackTimer();
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.client.disconnect();
  }

  private emit() {
    this.listeners.forEach((listener) => listener(this.tokens));
    this.status = {
      ...this.status,
      tokenCount: this.tokens.length,
    };
    this.emitStatus();
  }

  private emitStatus() {
    this.statusListeners.forEach((listener) => listener(this.status));
  }

  private scheduleFallbackTimer() {
    this.clearFallbackTimer();
    this.fallbackTimer = window.setTimeout(() => {
      if (!this.hasLiveData) {
        this.tokens = fallbackTokenCatalog;
        this.status = {
          connection: "fallback",
          source: "fallback",
          tokenCount: this.tokens.length,
          retryCount: this.retryCount,
          lastUpdatedAt: this.status.lastUpdatedAt,
        };
        this.emit();
      }
    }, INITIAL_TIMEOUT_MS);
  }

  private clearFallbackTimer() {
    if (this.fallbackTimer) {
      window.clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    const delay = Math.min(30_000, 1_000 * 2 ** this.retryCount);
    this.retryCount += 1;
    this.status = {
      connection: "reconnecting",
      source: this.hasLiveData ? "pumpportal" : "fallback",
      tokenCount: this.tokens.length,
      retryCount: this.retryCount,
      lastUpdatedAt: this.status.lastUpdatedAt,
    };
    this.emitStatus();
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.client.connect();
    }, delay);
  }
}
