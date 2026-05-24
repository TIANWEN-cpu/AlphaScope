"use client";

import { useState, useEffect } from "react";
import {
  Zap,
  FileText,
  Megaphone,
  Lightbulb,
  Building2,
  Newspaper,
  BarChart3,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listNews,
  listAnnouncements,
  searchNews,
  type NewsItem,
} from "@/lib/api";

type SubTab = "stock" | "announce" | "concept" | "industry" | "telegraph" | "research";

const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
  { id: "stock", label: "个股新闻", icon: <Zap size={13} /> },
  { id: "announce", label: "公告", icon: <FileText size={13} /> },
  { id: "concept", label: "概念相关", icon: <Lightbulb size={13} /> },
  { id: "industry", label: "行业动态", icon: <Building2 size={13} /> },
  { id: "telegraph", label: "市场快讯", icon: <Megaphone size={13} /> },
  { id: "research", label: "机构研报", icon: <BarChart3 size={13} /> },
];

interface NewsPanelProps {
  symbol: string;
  stockName: string;
}

export function NewsPanel({ symbol, stockName }: NewsPanelProps) {
  const [activeTab, setActiveTab] = useState<SubTab>("stock");
  const [news, setNews] = useState<NewsItem[]>([]);
  const [announcements, setAnnouncements] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [newsRes, annRes] = await Promise.all([
          listNews({ symbol, limit: 30 }).catch(() => ({ news: [] })),
          listAnnouncements({ symbol, limit: 20 }).catch(() => ({ announcements: [] })),
        ]);
        setNews(newsRes.news || []);
        setAnnouncements(annRes.announcements || []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [symbol]);

  // Filter news by keywords for different sub-tabs
  const stockKeywords = [stockName, symbol];
  const stockNews = news.filter(
    (n) =>
      stockKeywords.some(
        (k) => k && (n.title?.includes(k) || n.summary?.includes(k))
      ) || n.event_type === "stock"
  );
  const conceptNews = news.filter(
    (n) =>
      n.event_type === "concept" ||
      n.title?.includes("概念") ||
      n.title?.includes("板块")
  );
  const industryNews = news.filter(
    (n) =>
      n.event_type === "industry" ||
      n.title?.includes("行业") ||
      n.title?.includes("产业")
  );
  const telegraphNews = news.filter(
    (n) => n.event_type === "news" || n.source === "cls"
  );
  const researchNews = news.filter(
    (n) =>
      n.event_type === "research" ||
      n.title?.includes("研报") ||
      n.title?.includes("评级")
  );

  const getTabData = (): NewsItem[] => {
    switch (activeTab) {
      case "stock":
        return stockNews.length > 0 ? stockNews : news;
      case "announce":
        return announcements;
      case "concept":
        return conceptNews;
      case "industry":
        return industryNews;
      case "telegraph":
        return telegraphNews;
      case "research":
        return researchNews;
      default:
        return news;
    }
  };

  const tabData = getTabData();

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4 gap-3 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-100 flex items-center gap-2 font-display">
          <Newspaper size={20} className="text-amber-400" />
          资讯与研报
          <span className="text-xs text-neutral-500 font-normal ml-2 font-mono">
            {stockName} ({symbol})
          </span>
        </h2>
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-1"
        >
          <RefreshCw size={12} /> 刷新
        </button>
      </div>

      {/* Sub tabs */}
      <div className="flex gap-1 flex-wrap">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors ${
              activeTab === tab.id
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                : "border-white/5 text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02]"
            }`}
          >
            {tab.icon} {tab.label}
            {tab.id === "announce" && announcements.length > 0 && (
              <span className="ml-1 text-[10px] bg-indigo-500/20 px-1 rounded">
                {announcements.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-neutral-500 text-sm">
          <RefreshCw size={14} className="animate-spin mr-2" />
          加载资讯...
        </div>
      ) : tabData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-neutral-600">
          <Newspaper size={32} className="opacity-20 mb-2" />
          <p className="text-sm">暂无{SUB_TABS.find((t) => t.id === activeTab)?.label}数据</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tabData.map((item, i) => (
            <div
              key={item.id || i}
              className="bg-black/20 rounded-xl border border-white/5 p-3 hover:border-white/10 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-indigo-500/30 text-indigo-400 bg-indigo-500/10 font-mono">
                      {item.source || "快讯"}
                    </span>
                    {item.event_type && (
                      <span className="text-[10px] text-neutral-600 font-mono">
                        {item.event_type}
                      </span>
                    )}
                    <span className="text-[10px] text-neutral-600 font-mono">
                      {item.published_at || item.datetime || ""}
                    </span>
                    {item.sentiment !== undefined && item.sentiment !== 0 && (
                      <span
                        className={`text-[10px] font-mono ${
                          item.sentiment > 0 ? "text-rose-400" : "text-emerald-400"
                        }`}
                      >
                        {item.sentiment > 0 ? "+" : ""}
                        {item.sentiment.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-200 leading-relaxed">
                    {item.title || "无标题"}
                  </p>
                  {item.summary && (
                    <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                      {item.summary}
                    </p>
                  )}
                </div>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-600 hover:text-indigo-400 transition-colors flex-shrink-0"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
