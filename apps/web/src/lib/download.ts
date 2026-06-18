/**
 * 客户端文件下载工具(纯新增)。
 * 把文本内容作为文件触发浏览器下载,用于导出研究成果(Markdown 等)。
 */

export function downloadText(filename: string, content: string, mime = 'text/markdown;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
