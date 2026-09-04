"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MapPinned, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  liveMapSourceLabel,
  projectWorldToMap,
  type LiveMapPlayer,
  type LiveMapSnapshot,
} from "@/lib/live-map";

const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 600;
const POLL_MS = 15_000;

const REGION_LABELS: { name: string; x: number; y: number }[] = [
  { name: "Paleto Bay", x: -200, y: 6300 },
  { name: "Sandy Shores", x: 1700, y: 3600 },
  { name: "Los Santos", x: 200, y: -1400 },
];

function formatCoord(value: number): string {
  return value.toFixed(1);
}

function statusCopy(snapshot: LiveMapSnapshot): { title: string; body: string } {
  if (!snapshot.available) {
    return {
      title: "Waiting for a position publisher",
      body:
        snapshot.note ||
        "Live positions require a FiveM server or Renny publisher. No coordinates are invented here.",
    };
  }
  if (snapshot.players.length === 0) {
    return {
      title: "Publisher connected — no online players",
      body: "The last ingest was empty. Markers appear only from published live positions.",
    };
  }
  return {
    title: `${snapshot.players.length} online`,
    body: `Last ingest from ${liveMapSourceLabel(snapshot.source)}.`,
  };
}

function PlayerMarker({
  player,
  selected,
  onSelect,
}: {
  player: LiveMapPlayer;
  selected: boolean;
  onSelect: (identifier: string) => void;
}) {
  const point = projectWorldToMap(player.x, player.y, VIEW_WIDTH, VIEW_HEIGHT);
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={player.name || player.identifier}
      onClick={() => onSelect(player.identifier)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(player.identifier);
        }
      }}
      className="cursor-pointer"
    >
      <circle
        cx={point.x}
        cy={point.y}
        r={selected ? 8 : 5.5}
        className={selected ? "fill-primary" : "fill-info"}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <text
        x={point.x + 10}
        y={point.y + 4}
        className="fill-foreground text-[10px]"
      >
        {player.name || player.identifier}
      </text>
    </g>
  );
}

export function StaffLiveMap({ initialSnapshot }: { initialSnapshot: LiveMapSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/staff-tools/live-map", { cache: "no-store" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error || `Refresh failed (${response.status})`);
        return;
      }
      const next = (await response.json()) as LiveMapSnapshot;
      setSnapshot(next);
      setError(null);
    } catch {
      setError("Unable to refresh live positions.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const selected = snapshot.players.find((player) => player.identifier === selectedId) ?? null;
  const copy = statusCopy(snapshot);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <MapPinned className="h-4 w-4 text-primary" />
            Live player map
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge tone={snapshot.available ? "success" : "warning"} size="xs">
              {snapshot.available ? "Publisher seen" : "No publisher"}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="relative overflow-hidden bg-[color:color-mix(in_srgb,var(--info)_18%,var(--surface-2))]">
            <svg
              viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
              className="block h-auto w-full text-border"
              role="img"
              aria-label="San Andreas map shell"
            >
              <rect width={VIEW_WIDTH} height={VIEW_HEIGHT} className="fill-transparent" />
              {Array.from({ length: 8 }, (_, index) => (
                <line
                  key={`v-${index}`}
                  x1={(VIEW_WIDTH / 8) * index}
                  y1={0}
                  x2={(VIEW_WIDTH / 8) * index}
                  y2={VIEW_HEIGHT}
                  className="stroke-border/70"
                  strokeWidth={1}
                />
              ))}
              {Array.from({ length: 6 }, (_, index) => (
                <line
                  key={`h-${index}`}
                  x1={0}
                  y1={(VIEW_HEIGHT / 6) * index}
                  x2={VIEW_WIDTH}
                  y2={(VIEW_HEIGHT / 6) * index}
                  className="stroke-border/70"
                  strokeWidth={1}
                />
              ))}
              <path
                d="M90 210 C160 150 250 130 340 150 C430 170 500 140 560 180 C620 220 670 260 700 330 C730 400 710 470 650 510 C590 550 500 560 420 540 C340 520 280 530 220 500 C150 465 80 420 70 340 C60 270 50 250 90 210 Z"
                className="fill-[color:color-mix(in_srgb,var(--success)_16%,var(--surface))] stroke-border-strong"
                strokeWidth={1.5}
              />
              <path
                d="M280 70 C340 40 430 45 500 80 C560 110 590 160 560 200 C520 180 450 165 380 175 C320 184 270 160 260 120 C252 92 250 82 280 70 Z"
                className="fill-[color:color-mix(in_srgb,var(--success)_12%,var(--surface))] stroke-border"
                strokeWidth={1}
              />
              <ellipse
                cx={430}
                cy={185}
                rx={48}
                ry={22}
                className="fill-[color:color-mix(in_srgb,var(--info)_28%,var(--surface-2))] stroke-border"
              />
              {REGION_LABELS.map((region) => {
                const point = projectWorldToMap(region.x, region.y, VIEW_WIDTH, VIEW_HEIGHT);
                return (
                  <text
                    key={region.name}
                    x={point.x}
                    y={point.y}
                    className="fill-subtle-foreground text-[11px] uppercase tracking-wider"
                  >
                    {region.name}
                  </text>
                );
              })}
              {snapshot.players.map((player) => (
                <PlayerMarker
                  key={player.identifier}
                  player={player}
                  selected={player.identifier === selectedId}
                  onSelect={setSelectedId}
                />
              ))}
            </svg>
            {snapshot.players.length === 0 && (
              <div className="absolute inset-0 flex items-end justify-center bg-background/20 p-4">
                <div className="max-w-xl rounded-md border border-border bg-elevated/95 px-4 py-3 text-sm shadow-sm">
                  <p className="font-medium text-foreground">{copy.title}</p>
                  <p className="mt-1 text-muted-foreground">{copy.body}</p>
                </div>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Status</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm text-muted-foreground">
            <p>
              Source:{" "}
              <span className="text-foreground">{liveMapSourceLabel(snapshot.source)}</span>
            </p>
            <p>
              Online markers:{" "}
              <span className="tabular-nums text-foreground">{snapshot.players.length}</span>
            </p>
            <p>
              Last ingest:{" "}
              <span className="text-foreground">
                {snapshot.receivedAt ? new Date(snapshot.receivedAt).toLocaleString() : "never"}
              </span>
            </p>
            {error && <p className="text-danger">{error}</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Selected</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            {selected ? (
              <>
                <p className="font-medium text-foreground">{selected.name || selected.identifier}</p>
                <p className="font-mono text-xs text-muted-foreground">{selected.identifier}</p>
                <p className="tabular-nums text-muted-foreground">
                  x {formatCoord(selected.x)} · y {formatCoord(selected.y)}
                  {selected.z != null ? ` · z ${formatCoord(selected.z)}` : ""}
                </p>
                <Link
                  href={`/staff-tools/players/${encodeURIComponent(selected.identifier)}`}
                  className="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs font-medium text-foreground hover:bg-muted"
                >
                  Open player profile
                </Link>
              </>
            ) : (
              <p className="text-muted-foreground">
                {snapshot.players.length === 0
                  ? "No live markers to select."
                  : "Click a published marker to inspect it."}
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
