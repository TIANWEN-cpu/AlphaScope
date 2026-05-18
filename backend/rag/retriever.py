"""RAG 检索器 - 统一检索接口"""

from __future__ import annotations

import logging
from typing import Optional

from .chunker import TextChunker
from .vector_store import VectorStore

logger = logging.getLogger(__name__)


class Retriever:
    """统一 RAG 检索器

    整合分块和向量检索, 提供端到端的文档索引和查询。
    """

    def __init__(self) -> None:
        self.chunker = TextChunker()
        self.store = VectorStore()

    def index_document(
        self,
        collection: str,
        text: str,
        metadata: dict,
    ) -> int:
        """将文档分块并索引到向量库

        Returns:
            索引的 chunk 数量
        """
        chunks = self.chunker.chunk_text(text, metadata)
        if not chunks:
            return 0

        self.store.add_documents(
            collection_name=collection,
            documents=[c["text"] for c in chunks],
            metadatas=[{k: v for k, v in c.items() if k != "text"} for c in chunks],
            ids=[c["chunk_id"] for c in chunks],
        )
        return len(chunks)

    def search(
        self,
        collection: str,
        query: str,
        n_results: int = 5,
        symbol: Optional[str] = None,
    ) -> list[dict]:
        """检索相似文档"""
        where = None
        if symbol:
            where = {"symbol": symbol}
        return self.store.query(collection, query, n_results, where)

    def index_news(self, items: list[dict]) -> int:
        """批量索引新闻"""
        count = 0
        for item in items:
            text = f"{item.get('title', '')}\n{item.get('summary', '')}\n{item.get('content', '')}"
            if not text.strip():
                continue
            metadata = {
                "source": item.get("source", ""),
                "doc_type": "news",
                "published_at": str(item.get("datetime", "")),
                "symbols": ",".join(item.get("symbols", [])),
            }
            count += self.index_document("news_chunks", text, metadata)
        return count

    def index_reports(self, items: list[dict]) -> int:
        """批量索引研报"""
        count = 0
        for item in items:
            text = f"{item.get('title', '')}\n{item.get('summary', '')}"
            if not text.strip():
                continue
            metadata = {
                "source": item.get("source", ""),
                "doc_type": "report",
                "institution": item.get("institution", ""),
                "symbols": ",".join(item.get("symbols", [])),
                "published_at": str(item.get("datetime", "")),
            }
            count += self.index_document("report_chunks", text, metadata)
        return count

    def index_announcements(self, items: list[dict]) -> int:
        """批量索引公告"""
        count = 0
        for item in items:
            text = f"{item.get('title', '')}\n{item.get('content', '')}"
            if not text.strip():
                continue
            metadata = {
                "source": item.get("source", ""),
                "doc_type": "announcement",
                "symbol": item.get("symbol", ""),
                "published_at": str(item.get("datetime", "")),
            }
            count += self.index_document("announcement_chunks", text, metadata)
        return count
