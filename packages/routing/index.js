import routing from "./index.cjs";

// ESM consumers use the same implementation as the CommonJS services.
export const {
  reservedNames,
  codePattern,
  isReservedName,
  isShortLinkPath,
  shortLinkPath,
  rootShortLinkPattern,
  rootShortLinkSource,
} = routing;
