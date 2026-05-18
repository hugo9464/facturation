"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Clock,
  FolderKanban,
  ListTodo,
  Users,
  FileText,
  FileSignature,
  Settings,
  LogOut,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  parseSeenProjectTaskUpdates,
  timestampValue,
} from "@/lib/todo-task-review";
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_PREFERENCES_STORAGE_KEY,
  clampSidebarWidth,
  parseSidebarPreferences,
  serializeSidebarPreferences,
} from "@/lib/sidebar-preferences";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/actions/auth";
import { TimeEntryDialog } from "@/components/time-entry-dialog";
import type { TimeEntryProjectOption } from "@/components/time-entry-dialog";
import { HermesTerminalDialog } from "@/components/hermes-terminal-dialog";

type SidebarProject = {
  id: string;
  name: string;
  clientName: string | null;
  clientArchived: boolean;
  latestTaskUpdate: string | null;
};

const PROJECT_TASK_SEEN_STORAGE_KEY = "facturation.todo.project-task-seen.v1";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projets", icon: FolderKanban },
  { href: "/time", label: "Temps", icon: Clock },
  { href: "/todo", label: "Todo", icon: ListTodo },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/quotes", label: "Devis", icon: FileSignature },
  { href: "/invoices", label: "Factures", icon: FileText },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppShell({
  children,
  email,
  projects,
  sidebarProjects,
}: {
  children: React.ReactNode;
  email: string;
  projects: TimeEntryProjectOption[];
  sidebarProjects: SidebarProject[];
}) {
  const pathname = usePathname();
  const projectTaskUpdateTimes = useMemo(
    () =>
      Object.fromEntries(
        sidebarProjects.map((project) => [
          project.id,
          timestampValue(project.latestTaskUpdate),
        ]),
      ),
    [sidebarProjects],
  );
  const [seenProjectTaskUpdates, setSeenProjectTaskUpdates] = useState<
    Record<string, number>
  >({});
  const [seenProjectTaskUpdatesLoaded, setSeenProjectTaskUpdatesLoaded] =
    useState(false);
  const currentProjectId = pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPreferencesLoaded, setSidebarPreferencesLoaded] = useState(false);
  const sidebarDisplayWidth = sidebarCollapsed
    ? SIDEBAR_COLLAPSED_WIDTH
    : sidebarWidth;
  const toggleSidebarLabel = sidebarCollapsed
    ? "Déplier la sidebar"
    : "Replier la sidebar";

  useEffect(() => {
    if (sidebarPreferencesLoaded) return;
    const frame = window.requestAnimationFrame(() => {
      const preferences = parseSidebarPreferences(
        window.localStorage.getItem(SIDEBAR_PREFERENCES_STORAGE_KEY),
      );
      if (preferences) {
        setSidebarWidth(preferences.width);
        setSidebarCollapsed(preferences.collapsed);
      }
      setSidebarPreferencesLoaded(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [sidebarPreferencesLoaded]);

  useEffect(() => {
    if (!sidebarPreferencesLoaded) return;
    window.localStorage.setItem(
      SIDEBAR_PREFERENCES_STORAGE_KEY,
      serializeSidebarPreferences({
        width: sidebarWidth,
        collapsed: sidebarCollapsed,
      }),
    );
  }, [sidebarCollapsed, sidebarPreferencesLoaded, sidebarWidth]);

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((collapsed) => !collapsed);
  }

  function startSidebarResize(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    setSidebarCollapsed(false);
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    const handlePointerMove = (moveEvent: PointerEvent) => {
      setSidebarWidth(clampSidebarWidth(startWidth + moveEvent.clientX - startX));
    };
    const stopResize = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
  }

  useEffect(() => {
    if (seenProjectTaskUpdatesLoaded) return;
    const frame = window.requestAnimationFrame(() => {
      const stored = parseSeenProjectTaskUpdates(
        window.localStorage.getItem(PROJECT_TASK_SEEN_STORAGE_KEY),
      );
      const initialSeen = stored ?? projectTaskUpdateTimes;
      setSeenProjectTaskUpdates(initialSeen);
      setSeenProjectTaskUpdatesLoaded(true);
      if (!stored) {
        window.localStorage.setItem(
          PROJECT_TASK_SEEN_STORAGE_KEY,
          JSON.stringify(initialSeen),
        );
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [projectTaskUpdateTimes, seenProjectTaskUpdatesLoaded]);

  useEffect(() => {
    if (!seenProjectTaskUpdatesLoaded || !currentProjectId) return;
    const frame = window.requestAnimationFrame(() => {
      const latest = projectTaskUpdateTimes[currentProjectId] ?? 0;
      if (!latest) return;
      setSeenProjectTaskUpdates((current) => {
        if ((current[currentProjectId] ?? 0) >= latest) return current;
        const next = { ...current, [currentProjectId]: latest };
        window.localStorage.setItem(
          PROJECT_TASK_SEEN_STORAGE_KEY,
          JSON.stringify(next),
        );
        return next;
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentProjectId, projectTaskUpdateTimes, seenProjectTaskUpdatesLoaded]);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "relative hidden shrink-0 md:flex md:flex-col md:border-r md:bg-sidebar md:text-sidebar-foreground",
          sidebarCollapsed ? "items-center" : "",
        )}
        style={{ width: sidebarDisplayWidth, flexBasis: sidebarDisplayWidth }}
      >
        <div
          className={cn(
            "flex w-full items-center border-b border-sidebar-border py-3",
            sidebarCollapsed ? "justify-center px-2" : "justify-between gap-2 px-4",
          )}
        >
          {!sidebarCollapsed ? (
            <Link href="/" className="min-w-0 truncate text-lg font-semibold tracking-tight">
              Facturation
            </Link>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={toggleSidebarLabel}
            title={toggleSidebarLabel}
            aria-pressed={sidebarCollapsed}
            onClick={toggleSidebarCollapsed}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </Button>
        </div>
        <div className={cn("flex-1 overflow-y-auto py-4", sidebarCollapsed ? "px-2" : "px-3")}>
          <nav className="space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={sidebarCollapsed ? item.label : undefined}
                  aria-label={sidebarCollapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center rounded-md text-sm transition-colors",
                    sidebarCollapsed
                      ? "justify-center px-2 py-2.5"
                      : "gap-3 px-3 py-2",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium ring-1 ring-sidebar-border"
                      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {!sidebarCollapsed ? item.label : null}
                </Link>
              );
            })}
          </nav>

          {!sidebarCollapsed ? (
            <div className="mt-6 border-t border-sidebar-border pt-4">
              <div className="mb-2 flex items-center justify-between px-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Projets
                </p>
                <Link
                  href="/projects"
                  className="text-xs text-muted-foreground hover:text-sidebar-accent-foreground"
                >
                  Tout
                </Link>
              </div>
              <nav className="space-y-1">
                {sidebarProjects.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    Aucun projet
                  </p>
                ) : (
                  sidebarProjects.map((project) => {
                    const href = `/projects/${project.id}`;
                    const active = isActive(pathname, href);
                    const hasUnseenTaskChange =
                      seenProjectTaskUpdatesLoaded &&
                      !active &&
                      (projectTaskUpdateTimes[project.id] ?? 0) >
                        (seenProjectTaskUpdates[project.id] ?? 0);
                    return (
                      <Link
                        key={project.id}
                        href={href}
                        className={cn(
                          "block rounded-md px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium ring-1 ring-sidebar-border"
                            : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="block min-w-0 flex-1 truncate">{project.name}</span>
                          {hasUnseenTaskChange ? (
                            <span
                              className="size-2 shrink-0 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.85)]"
                              aria-label="Tâches modifiées"
                              title="Tâches modifiées"
                            />
                          ) : null}
                        </span>
                        <span className="block truncate text-[11px] font-normal opacity-75">
                          {project.clientName
                            ? project.clientArchived
                              ? `${project.clientName} · archivé`
                              : project.clientName
                            : "Client à assigner"}
                        </span>
                      </Link>
                    );
                  })
                )}
              </nav>
            </div>
          ) : null}
        </div>
        <div className={cn("space-y-1 border-t border-sidebar-border py-3", sidebarCollapsed ? "w-full px-2" : "px-3")}>
          <Link
            href="/settings"
            title={sidebarCollapsed ? "Paramètres" : undefined}
            aria-label={sidebarCollapsed ? "Paramètres" : undefined}
            className={cn(
              "flex items-center rounded-md text-sm transition-colors",
              sidebarCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2",
              isActive(pathname, "/settings")
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium ring-1 ring-sidebar-border"
                : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
            )}
          >
            <Settings className="size-4" />
            {!sidebarCollapsed ? "Paramètres" : null}
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              title={sidebarCollapsed ? "Déconnexion" : undefined}
              aria-label={sidebarCollapsed ? "Déconnexion" : undefined}
              className={cn(
                "w-full flex items-center rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors",
                sidebarCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2",
              )}
            >
              <LogOut className="size-4" />
              {!sidebarCollapsed ? "Déconnexion" : null}
            </button>
          </form>
          {!sidebarCollapsed ? (
            <p className="px-3 pt-2 text-[11px] text-muted-foreground/80 truncate">
              {email}
            </p>
          ) : null}
        </div>
        {!sidebarCollapsed ? (
          <button
            type="button"
            aria-label="Redimensionner la sidebar"
            title="Redimensionner la sidebar"
            onPointerDown={startSidebarResize}
            className="absolute -right-2 top-0 hidden h-full w-4 cursor-col-resize items-center justify-center text-muted-foreground/50 transition-colors hover:text-muted-foreground md:flex"
          >
            <span className="flex h-10 w-3 items-center justify-center rounded-full bg-sidebar-accent/70 opacity-0 shadow-sm ring-1 ring-sidebar-border transition-opacity hover:opacity-100">
              <GripVertical className="size-3" />
            </span>
          </button>
        ) : null}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur md:px-6">
          <div className="md:hidden text-base font-semibold">Facturation</div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <HermesTerminalDialog />
            <TimeEntryDialog projects={projects}>
              <Button size="sm" className="gap-1.5">
                <Plus className="size-4" />
                <span className="hidden sm:inline">Logger temps</span>
                <span className="sm:hidden">Temps</span>
              </Button>
            </TimeEntryDialog>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 pb-20 md:px-6 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 grid grid-cols-7 border-t bg-background/95 backdrop-blur md:hidden">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px]",
                active
                  ? "text-foreground font-medium"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
