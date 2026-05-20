"""向量存储层 - 基于 ChromaDB 的向量检索"""

from __future__ import annotations

import logging
import threading
from typing import Optional

logger = logging.getLogger(__name__)

from backend.project_paths import CACHE_DIR

CHROMA_DIR = CACHE_DIR / "chroma_db"


class VectorStore:
    """ChromaDB 向量存储管理

    Thread-safe singleton with double-checked locking.
    """

    _instance: Optional["VectorStore"] = None
    _lock = threading.Lock()

    def __new__(cls) -> "VectorStore":
        with cls._lock:
            if cls._instance is None:
                inst = super().__new__(cls)
                inst._initialized = False
                cls._instance = inst
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._initialized = True
        CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        self._client = None
        self._collections: dict = {}

    def _get_client(self):
        if self._client is None:
            try:
                import chromadb
            except ImportError:
                logger.warning(
                    "chromadb 未安装，RAG 向量检索功能不可用。安装命令: pip install chromadb==0.6.3"
                )
                return None
            self._client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        return self._client

    def get_collection(self, name: str):
        """获取或创建 collection"""
        if name not in self._collections:
            client = self._get_client()
            if client is None:
                raise RuntimeError("chromadb 未安装，无法创建向量集合")
            self._collections[name] = client.get_or_create_collection(
                name=name,
                metadata={"hnsw:space": "cosine"},
            )
        return self._collections[name]

    def add_documents(
        self,
        collection_name: str,
        documents: list[str],
        metadatas: list[dict],
        ids: list[str],
    ) -> None:
        """添加文档到向量库"""
        collection = self.get_collection(collection_name)
        collection.add(
            documents=documents,
            metadatas=metadatas,
            ids=ids,
        )
        logger.info(
            "向量库 %s 添加 %d 个文档",
            collection_name,
            len(documents),
        )

    def query(
        self,
        collection_name: str,
        query_text: str,
        n_results: int = 5,
        where: Optional[dict] = None,
    ) -> list[dict]:
        """查询相似文档"""
        collection = self.get_collection(collection_name)
        kwargs = {
            "query_texts": [query_text],
            "n_results": n_results,
        }
        if where:
            kwargs["where"] = where

        results = collection.query(**kwargs)

        docs = []
        for i in range(len(results["documents"][0])):
            docs.append(
                {
                    "text": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i]
                    if results["metadatas"]
                    else {},
                    "distance": results["distances"][0][i]
                    if results["distances"]
                    else 0,
                    "id": results["ids"][0][i] if results["ids"] else "",
                }
            )
        return docs

    def get_collection_stats(self) -> dict:
        """获取所有 collection 统计"""
        client = self._get_client()
        if client is None:
            return {}
        stats = {}
        for col in client.list_collections():
            stats[col.name] = col.count()
        return stats
