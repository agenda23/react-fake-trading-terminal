import { useEffect, useState } from "react";
import { fallbackTokenCatalog } from "../data/tokens";
import { TokenSourceService } from "../services/tokenSourceService";
import type { TokenCatalogItem, TokenFeedStatus } from "../types";

interface UseTokenCatalogOptions {
  maxPerMinute: number;
  maxCatalogSize: number;
}

export const useTokenCatalog = ({ maxPerMinute, maxCatalogSize }: UseTokenCatalogOptions) => {
  const [tokens, setTokens] = useState<TokenCatalogItem[]>(fallbackTokenCatalog);
  const [status, setStatus] = useState<TokenFeedStatus>({
    connection: "connecting",
    source: "fallback",
    tokenCount: fallbackTokenCatalog.length,
    retryCount: 0,
    lastUpdatedAt: null,
  });

  useEffect(() => {
    const service = new TokenSourceService({ maxPerMinute, maxCatalogSize });
    const unsubscribe = service.subscribe(setTokens);
    const unsubscribeStatus = service.subscribeStatus(setStatus);
    const stop = service.start();

    return () => {
      unsubscribe();
      unsubscribeStatus();
      stop();
    };
  }, [maxCatalogSize, maxPerMinute]);

  return { tokens, status };
};
