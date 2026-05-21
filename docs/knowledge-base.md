# 知识库管理

v0.48 新增功能。支持上传文档、管理文件、语义搜索。

## 功能概述

| 功能 | 端点 | 说明 |
|------|------|------|
| 上传文件 | `POST /api/knowledge/upload` | 解析 → 分块 → 索引 |
| 文档列表 | `GET /api/knowledge/documents` | 支持 source_type 过滤 |
| 文档详情 | `GET /api/knowledge/documents/{id}` | 包含 chunks |
| 删除文档 | `DELETE /api/knowledge/documents/{id}` | 删除文档 + 索引 |
| 搜索 | `POST /api/knowledge/search` | 语义/关键词搜索 |

## 支持格式

- PDF (.pdf)
- Word (.docx)
- Excel (.xlsx)
- CSV (.csv)
- 文本 (.txt)
- Markdown (.md)
- JSON (.json)

最大文件大小：20MB

## 使用示例

### 上传文件

```bash
curl -X POST http://localhost:8000/api/knowledge/upload \
  -F "file=@report.pdf"
```

响应：
```json
{
  "success": true,
  "data": {
    "doc_id": "a1b2c3d4e5f6",
    "filename": "report.pdf",
    "chunks": 15,
    "processing_time_ms": 234.5,
    "file_size": 102400
  },
  "message": "文件上传并处理成功"
}
```

### 搜索知识库

```bash
curl -X POST http://localhost:8000/api/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{"query": "营收增长", "limit": 10}'
```

搜索策略：
- **ChromaDB 可用**：语义向量搜索（余弦相似度）
- **ChromaDB 不可用**：降级到 SQLite 关键词匹配

### 列出文档

```bash
curl http://localhost:8000/api/knowledge/documents
curl http://localhost:8000/api/knowledge/documents?source_type=upload
```

## 架构

```
上传文件 → 保存到 data/uploads/
         → DocumentPipeline 解析/分块
         → file_store 保存到 SQLite (documents + document_chunks)
         → VectorStore 索引到 ChromaDB (user_documents collection)
```

### 存储层

- **SQLite**：`documents` 表存储文件元数据，`document_chunks` 表存储分块内容
- **ChromaDB**：向量索引，支持语义搜索（可选依赖）

### 降级策略

ChromaDB 未安装时：
1. 文件上传仍可正常工作（保存到 SQLite）
2. 搜索自动降级到 SQLite LIKE 查询
3. 不影响其他功能

## 配置

无需额外配置。ChromaDB 为可选依赖：

```bash
pip install chromadb==0.6.3  # 可选：启用语义搜索
```
