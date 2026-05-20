"""RAG 检索增强生成层"""

try:
    import chromadb  # noqa: F401

    RAG_AVAILABLE = True
except ImportError:
    RAG_AVAILABLE = False
