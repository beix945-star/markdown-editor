export const KEY = "paper-markdown:v1";
export const MAX_BYTES = 1024 * 1024;
export type Doc = {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
};
export type Snapshot = {
  docs: Doc[];
  activeId: string;
  status: "saved" | "pending" | "error";
  error: string;
  blocked: boolean;
};
type StoragePort = Pick<Storage, "getItem" | "setItem">;
const welcome = `# 给想法留一页空间\n\n欢迎来到 **纸间**。左边写下文字，右边即刻看到排版。\n\n## 今天，从这里开始\n\n- [x] 创建第一篇文档\n- [ ] 记录一个新想法\n- [ ] 导出一份 Markdown 备份\n\n> 写作不必一步到位，先让想法发生。\n\n### 常用语法\n\n| 写法 | 效果 |\n| --- | --- |\n| **加粗** | 强调重点 |\n| *斜体* | 轻声补充 |\n\n\`行内代码\`，也可以写代码块：\n\n\`\`\`javascript\nconst idea = 'Hello, world!'\nconsole.log(idea)\n\`\`\`\n\n[了解 Markdown](https://commonmark.org/help/)\n`;
export function createDoc(title = "未命名文档", content = ""): Doc {
  return { id: crypto.randomUUID(), title, content, updatedAt: Date.now() };
}
export function decode(raw: string): { docs: Doc[]; activeId: string } {
  const value = JSON.parse(raw);
  if (
    value?.version !== 1 ||
    !Array.isArray(value.docs) ||
    typeof value.activeId !== "string"
  )
    throw new Error("格式不正确");
  const ids = new Set<string>();
  for (const d of value.docs) {
    if (
      !d ||
      typeof d.id !== "string" ||
      !d.id ||
      ids.has(d.id) ||
      typeof d.title !== "string" ||
      !d.title.trim() ||
      d.title.length > 100 ||
      typeof d.content !== "string" ||
      !Number.isFinite(d.updatedAt)
    )
      throw new Error("文档数据不正确");
    ids.add(d.id);
  }
  if (value.docs.length && !ids.has(value.activeId))
    throw new Error("选中文档不存在");
  return { docs: value.docs, activeId: value.activeId };
}
export function createStore(storage: StoragePort) {
  const first = createDoc("开始使用纸间", welcome);
  let state: Snapshot = {
    docs: [first],
    activeId: first.id,
    status: "pending",
    error: "",
    blocked: false,
  };
  try {
    const raw = storage.getItem(KEY);
    if (raw !== null) state = { ...state, ...decode(raw), status: "saved" };
  } catch {
    state = {
      ...state,
      status: "error",
      blocked: true,
      error:
        "无法读取本地数据。原始数据未覆盖；请先备份或恢复浏览器存储权限，再刷新。当前编辑只能导出保存。",
    };
  }
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const emit = () => listeners.forEach((fn) => fn());
  function flush() {
    clearTimeout(timer);
    timer = undefined;
    if (state.blocked || state.status === "saved") return;
    try {
      storage.setItem(
        KEY,
        JSON.stringify({
          version: 1,
          docs: state.docs,
          activeId: state.activeId,
        }),
      );
      state = { ...state, status: "saved", error: "" };
    } catch {
      state = {
        ...state,
        status: "error",
        error:
          "自动保存失败，内容仍保留在当前页面。请导出备份，或释放浏览器存储空间后重试。",
      };
    }
    emit();
  }
  function change(next: Partial<Snapshot>) {
    state = { ...state, ...next, status: state.blocked ? "error" : "pending" };
    clearTimeout(timer);
    if (!state.blocked) timer = setTimeout(flush, 500);
    emit();
  }
  if (state.status === "pending") timer = setTimeout(flush, 500);
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    flush,
    edit(id: string, content: string) {
      change({
        docs: state.docs.map((d) =>
          d.id === id ? { ...d, content, updatedAt: Date.now() } : d,
        ),
      });
    },
    rename(id: string, title: string) {
      title = title.trim();
      if (!title || title.length > 100)
        throw new Error("标题需要 1–100 个字符");
      change({
        docs: state.docs.map((d) =>
          d.id === id ? { ...d, title, updatedAt: Date.now() } : d,
        ),
      });
    },
    select(id: string) {
      if (state.docs.some((d) => d.id === id)) {
        flush();
        change({ activeId: id });
        flush();
      }
    },
    add(title?: string, content?: string) {
      flush();
      const doc = createDoc(title, content);
      change({ docs: [doc, ...state.docs], activeId: doc.id });
      flush();
    },
    importBackup(docs: Doc[]) {
      flush();
      const imported = docs.map((d) => createDoc(d.title, d.content));
      if (!imported.length) return;
      change({ docs: [...imported, ...state.docs], activeId: imported[0].id });
      flush();
    },
    remove(id: string) {
      const docs = state.docs.filter((d) => d.id !== id);
      change({
        docs,
        activeId: state.activeId === id ? (docs[0]?.id ?? "") : state.activeId,
      });
      flush();
    },
    externalChange() {
      clearTimeout(timer);
      state = {
        ...state,
        blocked: true,
        status: "error",
        error:
          "检测到另一标签页修改了文档，已暂停保存以防覆盖。请先导出当前内容，再刷新加载最新版本。",
      };
      emit();
    },
    dispose() {
      clearTimeout(timer);
      listeners.clear();
    },
  };
}
export type EditorStore = ReturnType<typeof createStore>;
export function safeUrl(value: string) {
  // Only web links, email links and in-document anchors are accepted.
  return /^(https?:\/\/|mailto:|#)/i.test(value) &&
    !Array.from(value).some(
      (char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127,
    )
    ? value
    : "";
}
export async function readMarkdown(file: File) {
  if (!/\.(md|markdown)$/i.test(file.name))
    throw new Error("请选择 .md 或 .markdown 文件");
  if (file.size > MAX_BYTES) throw new Error("文件不能超过 1 MB");
  let content: string;
  try {
    content = new TextDecoder("utf-8", { fatal: true }).decode(
      await file.arrayBuffer(),
    );
  } catch {
    throw new Error("无法读取文件，请确认它是 UTF-8 编码的文本");
  }
  if (content.includes("\0")) throw new Error("文件包含非文本内容");
  return {
    title:
      file.name
        .replace(/\.(md|markdown)$/i, "")
        .trim()
        .slice(0, 100) || "导入文档",
    content,
  };
}
export function filename(title: string) {
  return (
    (Array.from(title)
      .map((char) => (char.charCodeAt(0) < 32 ? "_" : char))
      .join("")
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/[. ]+$/g, "")
      .slice(0, 100) || "文档") + ".md"
  );
}
