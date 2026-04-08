import type { PumpPortalEvent, TokenCatalogItem } from "../types";

const TOKEN_TEXT_PATTERN = /^[\p{L}\p{N}\s._\-+&/()#$!?]{1,40}$/u;

export const normalizeTokenEvent = (event: PumpPortalEvent): TokenCatalogItem | null => {
  const mint = event.mint?.trim();
  const symbol = (event.symbol ?? event.metadata?.symbol ?? "").trim();
  const name = (event.name ?? event.metadata?.name ?? "").trim();

  if (!mint || !symbol || !name) return null;
  if (symbol.length > 16 || name.length > 40) return null;
  if (!TOKEN_TEXT_PATTERN.test(symbol) || !TOKEN_TEXT_PATTERN.test(name)) return null;

  return {
    mint,
    symbol,
    name,
    source: "pumpportal",
    discoveredAt: new Date(),
  };
};

export class PumpPortalClient {
  private socket: WebSocket | null = null;
  private onTokenHandlers = new Set<(item: TokenCatalogItem) => void>();
  private onCloseHandlers = new Set<() => void>();
  private onOpenHandlers = new Set<() => void>();

  connect() {
    if (typeof window === "undefined" || this.socket) return;

    const socket = new WebSocket("wss://pumpportal.fun/api/data");
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.onOpenHandlers.forEach((handler) => handler());
      socket.send(JSON.stringify({ method: "subscribeNewToken" }));
    });

    socket.addEventListener("message", (message) => {
      try {
        const payload = JSON.parse(String(message.data)) as PumpPortalEvent;
        const item = normalizeTokenEvent(payload);
        if (!item) return;
        this.onTokenHandlers.forEach((handler) => handler(item));
      } catch {
        return;
      }
    });

    const handleClose = () => {
      this.socket = null;
      this.onCloseHandlers.forEach((handler) => handler());
    };

    socket.addEventListener("close", handleClose);
    socket.addEventListener("error", () => {
      socket.close();
    });
  }

  onToken(handler: (item: TokenCatalogItem) => void) {
    this.onTokenHandlers.add(handler);
    return () => this.onTokenHandlers.delete(handler);
  }

  onOpen(handler: () => void) {
    this.onOpenHandlers.add(handler);
    return () => this.onOpenHandlers.delete(handler);
  }

  onClose(handler: () => void) {
    this.onCloseHandlers.add(handler);
    return () => this.onCloseHandlers.delete(handler);
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
  }
}
