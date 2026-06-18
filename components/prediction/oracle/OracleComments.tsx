// Per-oracle comments — composer + list, persisted in localStorage keyed by the
// URL oracle param. No backend, so it's local-only and seeded on first view.
"use client";

import { useEffect, useState } from "react";
import { Heart, ShieldAlert } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Comment = {
  id: string;
  author: string;
  text: string;
  ts: number;
  likes: number;
};

const SEED: { author: string; text: string; likes: number; minsAgo: number }[] =
  [
    {
      author: "satoshilite",
      text: "vault liquidity on these sub-hour BTC oracles is unreal",
      likes: 5,
      minsAgo: 6,
    },
    {
      author: "vol_harvester",
      text: "SVI smile is rich on the high wings rn — selling premium",
      likes: 2,
      minsAgo: 14,
    },
    {
      author: "gm_anon",
      text: "first time minting an Up here, ticket flow is clean",
      likes: 1,
      minsAgo: 28,
    },
  ];

const AVATAR_TINTS = [
  "bg-primary/20 text-primary",
  "bg-destructive/20 text-destructive",
  "bg-amber-500/20 text-amber-500",
  "bg-blue-500/20 text-blue-400",
  "bg-purple-500/20 text-purple-400",
];

function tintFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

function ago(ms: number): string {
  if (ms < 60_000) return "now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function OracleComments({ oracleId }: { oracleId: string }) {
  const key = `oracle-comments-${oracleId}`;
  const [comments, setComments] = useState<Comment[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        setComments(JSON.parse(raw));
        return;
      }
    } catch {}
    const base = Date.now();
    const seeded: Comment[] = SEED.map((s, i) => ({
      id: `seed-${i}`,
      author: s.author,
      text: s.text,
      ts: base - s.minsAgo * 60_000,
      likes: s.likes,
    }));
    setComments(seeded);
    try {
      window.localStorage.setItem(key, JSON.stringify(seeded));
    } catch {}
  }, [key]);

  const persist = (next: Comment[]) => {
    setComments(next);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  };

  const post = () => {
    const text = draft.trim();
    if (!text) return;
    persist([
      { id: `c-${Date.now()}`, author: "you", text, ts: Date.now(), likes: 0 },
      ...comments,
    ]);
    setDraft("");
  };

  const toggleLike = (id: string) => {
    const on = liked.has(id);
    setLiked(prev => {
      const n = new Set(prev);
      if (on) n.delete(id);
      else n.add(id);
      return n;
    });
    persist(
      comments.map(c =>
        c.id === id ? { ...c, likes: c.likes + (on ? -1 : 1) } : c,
      ),
    );
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-medium">
          Comments{" "}
          <span className="text-muted-foreground">{comments.length}</span>
        </h2>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldAlert className="size-3.5" />
          Beware of external links
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <Textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Add a comment…"
          rows={2}
        />
        <div className="flex justify-end">
          <Button
            variant="success"
            size="sm"
            disabled={!draft.trim()}
            onClick={post}
          >
            Post
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-col">
        {comments.map(c => (
          <div key={c.id} className="flex gap-3 border-t py-4 first:border-t-0">
            <Avatar className="size-8">
              <AvatarFallback
                className={cn("text-xs font-medium", tintFor(c.author))}
              >
                {c.author.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{c.author}</span>
                <span className="text-xs text-muted-foreground">
                  {ago(now - c.ts)}
                </span>
              </div>
              <p className="mt-0.5 text-sm break-words">{c.text}</p>
              <Button
                variant="ghost"
                size="xs"
                className="mt-1 -ml-2 text-muted-foreground"
                onClick={() => toggleLike(c.id)}
              >
                <Heart
                  className={cn(liked.has(c.id) && "fill-destructive text-destructive")}
                />
                {c.likes}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
