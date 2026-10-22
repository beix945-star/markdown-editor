# 纸间 · 在线 Markdown 文档编辑器

基于 React、TypeScript 和 Vite 的浏览器文档编辑器。第一版完整源码已实现，可在本机运行。文档保存在当前浏览器，不需要后端或 API 密钥。

## 已实现功能

- Markdown 双栏实时预览，支持标题、列表、表格、任务列表、引用、代码块。
- 新建、搜索标题与正文、切换、重命名和确认删除文档。
- 编辑 / 双栏 / 预览三种模式，格式快捷工具，字符与行数统计。
- 500 ms 防抖保存，切换文档前立即保存；刷新恢复文档及选中状态。
- 保存失败提示与重试，离开时对未保存内容提醒；损坏数据不自动覆盖。
- 检测其他标签页修改后暂停写入，提示先备份再刷新，避免覆盖。
- 导入 UTF-8 `.md` / `.markdown` 文件（最大 1 MB），导出单篇 Markdown。
- 全部文档 JSON 备份与恢复（最大 10 MB）；恢复追加新文档，不覆盖已有文档。
- 禁用原始 HTML，只允许受限链接协议；外部图片显示占位提示，不自动请求。
- 桌面双栏与窄屏上下布局、键盘焦点、对话框和保存状态提示。

## 在当前 Mac 上启动

双击 `启动项目.command`，或在本目录执行：

```bash
./project.sh dev
```

在 Firefox 中打开终端显示的地址，通常为 <http://127.0.0.1:5173/>。停止服务按 Control + C。启动脚本优先使用本机 Node.js / pnpm，也兼容当前电脑的 Codex 附带运行环境。

## 在其他电脑上运行

使用 Node.js 22.12+ 或更新的兼容 LTS，以及 pnpm：

```bash
git clone https://github.com/beix945-star/markdown-editor.git
cd markdown-editor/frontend
pnpm install --frozen-lockfile
pnpm dev
```

仓库当前为私有，克隆需要已授权的 GitHub 账号。依赖版本记录在 `frontend/pnpm-lock.yaml` 中。

## 验证与构建

```bash
./project.sh build
./project.sh test
./project.sh lint
```

- `build`：严格 TypeScript 检查与生产打包，输出 `frontend/dist`。
- `test`：Vitest 单元测试与组件交互测试。
- `lint`：Oxlint 静态检查。

测试覆盖防抖、快速切换、刷新恢复、存储失败与重试、损坏数据保护、跨标签页冲突、删除与重命名、导入校验、危险链接、Markdown 渲染以及页面主要操作。

## 代码在哪里

| 文件 | 职责 |
| --- | --- |
| `frontend/src/main.tsx` | 创建存储对象并挂载 React |
| `frontend/src/App.tsx` | 页面、文档操作、导入导出与浏览器事件 |
| `frontend/src/store.ts` | 文档模型、保存调度、校验与异常处理 |
| `frontend/src/Preview.tsx` | Markdown 渲染和安全链接 |
| `frontend/src/style.css` | 页面样式与响应式布局 |
| `frontend/src/*.test.ts*` | 单元与组件测试 |
| `docs/学习指南.md` | 适合初学者的阅读顺序与练习 |

## 数据边界与使用限制

这是浏览器本地应用，没有账号、云端同步或多人协作。浏览器清理数据、更换浏览器或更改访问地址/端口，会导致无法读到原来的本地文档；重要内容请先导出备份。保存失败时不要直接关闭页面。

损坏或无法访问的存储不会自动覆盖，当前会话仍可导出。多标签页冲突采用暂停保存并提示的保守策略，没有自动合并。Markdown 导入限制 1 MB，较长文档实时渲染仍可能变慢；尚未进行大规模性能测试。代码块提供排版，不包含语法高亮；图片不自动显示。本站尚未部署到公网。

预览安全策略基于 [react-markdown 官方说明](https://github.com/remarkjs/react-markdown)，未使用执行原始 HTML 的插件。
