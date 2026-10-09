export const reservedNames: readonly string[];
export const codePattern: RegExp;
export function isReservedName(name: string): boolean;
export function isShortLinkPath(path: string): boolean;
export function shortLinkPath(code: string): string;
export const rootShortLinkPattern: string;
export const rootShortLinkSource: string;
