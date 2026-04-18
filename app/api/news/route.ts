import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 120;

/**
 * GET /api/news — fetches real funding + hiring news from public RSS feeds,
 * normalizes into our Signal shape. No API key needed.
 *
 * Query:
 *   ?q=funding      — default: funding announcements
 *   ?q=hiring       — DevOps / platform engineering hiring
 *   ?q=saas-news    — B2B SaaS news
 */
type Signal = {
  id: string;
  company: string;
  type: "funding" | "hiring" | "social" | "stack" | "ma" | "news";
  icon: string;
  color: string;
  desc: string;
  tags: string[];
  score: number;
  time: number;
  url?: string;
  source?: string;
  published?: string;
};

const FEEDS: Record<string, { url: string; type: Signal["type"]; color: string; icon: string }> = {
  funding: {
    url: "https://news.google.com/rss/search?q=%22Series%20B%22%20OR%20%22Series%20A%22%20OR%20%22raised%22%20funding%20B2B%20SaaS&hl=en-US&gl=US&ceid=US:en",
    type: "funding",
    color: "accent",
    icon: "F",
  },
  hiring: {
    url: "https://news.google.com/rss/search?q=%22VP%20Engineering%22%20OR%20%22Head%20of%20Platform%22%20hiring%20DevOps&hl=en-US&gl=US&ceid=US:en",
    type: "hiring",
    color: "warning",
    icon: "H",
  },
  news: {
    url: "https://news.google.com/rss/search?q=B2B%20SaaS%20enterprise%20GTM&hl=en-US&gl=US&ceid=US:en",
    type: "news",
    color: "info",
    icon: "N",
  },
};

function stripTags(s: string): string {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .trim();
}

function extractCompany(title: string): string {
  const m =
    title.match(/^([A-Z][A-Za-z0-9&.\- ]+?)(?:\s+(?:raises|closes|secures|lands|announces|hires|launches|acquires|hiring))/i) ??
    title.match(/^([A-Z][A-Za-z0-9&.\- ]+?),/) ??
    title.match(/^([A-Z][A-Za-z0-9&.\- ]{2,30})\s+—/);
  return (m?.[1] ?? title.split(/[|—-]/)[0]).slice(0, 40).trim();
}

function parseRss(xml: string, feedMeta: typeof FEEDS[string]): Signal[] {
  const items: Signal[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = itemRe.exec(xml)) && idx < 10) {
    const block = m[1];
    const titleRaw = /<title>([\s\S]*?)<\/title>/.exec(block)?.[1] ?? "";
    const linkRaw = /<link>([\s\S]*?)<\/link>/.exec(block)?.[1] ?? "";
    const descRaw = /<description>([\s\S]*?)<\/description>/.exec(block)?.[1] ?? "";
    const pubRaw = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(block)?.[1] ?? "";
    const sourceRaw = /<source[^>]*>([\s\S]*?)<\/source>/.exec(block)?.[1] ?? "";
    const title = stripTags(titleRaw);
    if (!title) {
      idx++;
      continue;
    }
    const published = pubRaw ? new Date(pubRaw) : new Date();
    const minutesAgo = Math.max(1, Math.floor((Date.now() - published.getTime()) / 60_000));
    const score = 70 + Math.floor(Math.random() * 25);
    const company = extractCompany(title);
    items.push({
      id: `news_${Date.now()}_${idx}`,
      company,
      type: feedMeta.type,
      icon: feedMeta.icon,
      color: feedMeta.color,
      desc: stripTags(descRaw).slice(0, 180) || title,
      tags:
        feedMeta.type === "funding"
          ? ["Funding", "ICP match"]
          : feedMeta.type === "hiring"
            ? ["Hiring", "Growth signal"]
            : ["News"],
      score,
      time: minutesAgo,
      url: stripTags(linkRaw),
      source: stripTags(sourceRaw) || "Google News",
      published: published.toISOString(),
    });
    idx++;
  }
  return items;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "funding") as keyof typeof FEEDS;
  const meta = FEEDS[q] ?? FEEDS.funding;
  try {
    const res = await fetch(meta.url, {
      headers: { "User-Agent": "Multiply/1.0 (+hackathon demo)" },
      next: { revalidate: 120 },
    });
    if (!res.ok) {
      return NextResponse.json({ signals: [], error: `upstream ${res.status}` }, { status: 200 });
    }
    const xml = await res.text();
    const signals = parseRss(xml, meta);
    return NextResponse.json({ signals, count: signals.length, feed: q });
  } catch (err) {
    return NextResponse.json(
      { signals: [], error: (err as Error).message },
      { status: 200 },
    );
  }
}
