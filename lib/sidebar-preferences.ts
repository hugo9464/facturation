export const SIDEBAR_PREFERENCES_STORAGE_KEY = "facturation.app-sidebar.v1";

export const SIDEBAR_DEFAULT_WIDTH = 240;
export const SIDEBAR_MIN_WIDTH = 208;
export const SIDEBAR_MAX_WIDTH = 384;
export const SIDEBAR_COLLAPSED_WIDTH = 72;

type SidebarPreferences = {
  width: number;
  collapsed: boolean;
};

export function clampSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) return SIDEBAR_DEFAULT_WIDTH;
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)));
}

export function parseSidebarPreferences(raw: string | null): SidebarPreferences | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SidebarPreferences>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return {
      width: clampSidebarWidth(
        typeof parsed.width === "number" ? parsed.width : SIDEBAR_DEFAULT_WIDTH,
      ),
      collapsed: parsed.collapsed === true,
    };
  } catch {
    return null;
  }
}

export function serializeSidebarPreferences(preferences: SidebarPreferences): string {
  return JSON.stringify({
    width: clampSidebarWidth(preferences.width),
    collapsed: preferences.collapsed,
  });
}
