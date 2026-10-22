import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Preview from "./Preview";
import { KEY, decode, filename, readMarkdown, type EditorStore } from "./store";
export default function App({ store }: { store: EditorStore }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const doc = state.docs.find((d) => d.id === state.activeId);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("split");
  const [message, setMessage] = useState("");
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  const [title, setTitle] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const modal = useRef<HTMLDialogElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (dialog) modal.current?.showModal();
    else modal.current?.close();
  }, [dialog]);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      store.flush();
      if (store.getSnapshot().status !== "saved") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") store.flush();
    };
    const external = (e: StorageEvent) => {
      if (e.key === KEY || e.key === null) store.externalChange();
    };
    const shortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        store.flush();
      }
    };
    window.addEventListener("beforeunload", leave);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("storage", external);
    window.addEventListener("keydown", shortcut);
    return () => {
      window.removeEventListener("beforeunload", leave);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("storage", external);
      window.removeEventListener("keydown", shortcut);
      store.flush();
    };
  }, [store]);
  function download(
    text: string,
    name: string,
    type = "text/markdown;charset=utf-8",
  ) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function insert(before: string, after = "") {
    if (!doc || !editor.current) return;
    const el = editor.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    store.edit(
      doc.id,
      doc.content.slice(0, start) +
        before +
        doc.content.slice(start, end) +
        after +
        doc.content.slice(end),
    );
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    });
  }
  const filtered = state.docs.filter((d) =>
    (d.title + "\n" + d.content).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="app">
      <aside className="sidebar">
        <a className="brand" href="#">
          <span className="logo">纸</span>
          <span>
            纸间<small>让想法，自由生长</small>
          </span>
        </a>
        <button
          className="primary new"
          onClick={() => {
            store.add();
            setSearch("");
            setMessage("已新建文档");
          }}
        >
          ＋ 新建文档
        </button>
        <label className="search">
          <span>⌕</span>
          <input
            aria-label="搜索文档"
            placeholder="搜索标题与正文…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="list-heading">
          我的文档 <span>{state.docs.length}</span>
        </div>
        <nav aria-label="文档列表" className="documents">
          {filtered.map((d) => (
            <button
              key={d.id}
              aria-current={d.id === state.activeId ? "page" : undefined}
              className={
                d.id === state.activeId ? "document active" : "document"
              }
              onClick={() => store.select(d.id)}
            >
              <span className="doc-icon">▤</span>
              <span>
                <strong>{d.title}</strong>
                <small>
                  {new Date(d.updatedAt).toLocaleDateString("zh-CN")} ·{" "}
                  {d.content.length} 字符
                </small>
              </span>
            </button>
          ))}
          {!filtered.length && (
            <p className="muted empty-list">
              {search ? "没有找到匹配的文档" : "还没有文档，新建一篇吧。"}
            </p>
          )}
        </nav>
        <div className="sidebar-bottom">
          <button onClick={() => input.current?.click()}>
            ↥ 导入 Markdown
          </button>
          <button
            disabled={!state.docs.length}
            onClick={() =>
              download(
                JSON.stringify(
                  { version: 1, docs: state.docs, activeId: state.activeId },
                  null,
                  2,
                ),
                "纸间-全部文档备份.json",
                "application/json",
              )
            }
          >
            ↓ 备份全部文档
          </button>
          <button onClick={() => backupInput.current?.click()}>
            ↥ 恢复 JSON 备份
          </button>
          <p>
            仅存于当前浏览器
            <br />
            重要内容请定期导出备份
          </p>
        </div>
        <input
          ref={backupInput}
          type="file"
          accept=".json"
          hidden
          aria-label="恢复备份文件"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              if (!/\.json$/i.test(file.name) || file.size > 10 * 1024 * 1024)
                throw new Error("请选择不超过 10 MB 的 JSON 备份");
              const data = decode(await file.text());
              store.importBackup(data.docs);
              setSearch("");
              setMessage(`已恢复 ${data.docs.length} 篇文档，原有文档保持不变`);
            } catch {
              setMessage(
                "恢复失败：请选择纸间导出的有效 JSON 备份，最大 10 MB",
              );
            }
          }}
        />
        <input
          ref={input}
          type="file"
          accept=".md,.markdown"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              const data = await readMarkdown(file);
              store.add(data.title, data.content);
              setSearch("");
              setMessage("导入成功");
            } catch (error) {
              setMessage((error as Error).message);
            }
          }}
        />
      </aside>
      <main>
        <header>
          <div className="heading">
            <span className="eyebrow">YOUR WRITING SPACE</span>
            <h1>{doc?.title || "新的想法，从这里开始"}</h1>
          </div>
          <div className="header-actions">
            <span className={"save-status " + state.status}>
              {state.status === "saved"
                ? "● 已保存到本机"
                : state.status === "pending"
                  ? "◌ 正在保存…"
                  : "● 未保存"}
            </span>
            <button
              disabled={!doc}
              onClick={() => {
                if (doc) download(doc.content, filename(doc.title));
              }}
            >
              ↓ 导出 .md
            </button>
          </div>
        </header>
        {state.error && (
          <div className="error" role="alert">
            {state.error}{" "}
            {!state.blocked && <button onClick={store.flush}>重试保存</button>}
          </div>
        )}
        {message && (
          <div className="notice" role="status">
            {message}
            <button aria-label="关闭提示" onClick={() => setMessage("")}>
              ×
            </button>
          </div>
        )}
        {doc ? (
          <>
            <div className="toolbar">
              <div className="format-tools">
                <button
                  title="一级标题"
                  aria-label="插入标题"
                  onClick={() => insert("# ")}
                >
                  H₁
                </button>
                <button
                  title="加粗"
                  aria-label="插入加粗"
                  onClick={() => insert("**", "**")}
                >
                  <b>B</b>
                </button>
                <button
                  title="斜体"
                  aria-label="插入斜体"
                  onClick={() => insert("*", "*")}
                >
                  <i>I</i>
                </button>
                <button
                  title="无序列表"
                  aria-label="插入列表"
                  onClick={() => insert("- ")}
                >
                  ☷
                </button>
                <button
                  title="代码块"
                  aria-label="插入代码块"
                  onClick={() => insert("\n```\n", "\n```\n")}
                >
                  {"</>"}
                </button>
                <span className="divider" />
                <button
                  onClick={() => {
                    setTitle(doc.title);
                    setDialog("rename");
                  }}
                >
                  重命名
                </button>
                <button onClick={() => setDialog("delete")}>删除</button>
              </div>
              <div className="modes" aria-label="显示模式">
                {[
                  ["edit", "编辑"],
                  ["split", "双栏"],
                  ["preview", "预览"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={mode === value}
                    onClick={() => setMode(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className={"workspace " + mode}>
              <section className="editor-pane">
                <div className="pane-label">
                  MARKDOWN <span>纯粹书写</span>
                </div>
                <textarea
                  ref={editor}
                  aria-label="Markdown 正文"
                  spellCheck={false}
                  value={doc.content}
                  placeholder="在这里写下你的第一个想法…"
                  onChange={(e) => store.edit(doc.id, e.target.value)}
                />
              </section>
              <section className="preview-pane">
                <div className="pane-label">
                  PREVIEW <span>实时预览</span>
                </div>
                <article className="prose" aria-label="文档预览">
                  {doc.content ? (
                    <Preview content={doc.content} />
                  ) : (
                    <p className="muted">开始书写，预览将在这里出现。</p>
                  )}
                </article>
              </section>
            </div>
            <footer>
              <span>
                {doc.content.length} 字符 <span className="footer-dot">·</span>{" "}
                {doc.content.split("\n").length} 行
              </span>
              <span>
                Markdown / UTF-8 <span className="footer-dot">·</span> ⌘ / Ctrl
                + S 保存
              </span>
            </footer>
          </>
        ) : (
          <div className="empty">
            <span>✎</span>
            <h2>留一页，给新的想法</h2>
            <p>新建文档，或导入已有的 Markdown 文件。</p>
            <button className="primary" onClick={() => store.add()}>
              创建第一篇文档
            </button>
          </div>
        )}
      </main>
      <dialog
        ref={modal}
        onCancel={() => setDialog(null)}
        onClose={() => setDialog(null)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!doc) return;
            if (dialog === "delete") store.remove(doc.id);
            else {
              try {
                store.rename(doc.id, title);
              } catch (error) {
                setMessage((error as Error).message);
                return;
              }
            }
            setDialog(null);
          }}
        >
          <h2>{dialog === "delete" ? "删除这篇文档？" : "重命名文档"}</h2>
          {dialog === "delete" ? (
            <p>“{doc?.title}”将从本机移除。删除前可取消并导出备份。</p>
          ) : (
            <label>
              文档名称
              <input
                autoFocus
                required
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
          )}
          <div className="dialog-actions">
            <button type="button" onClick={() => setDialog(null)}>
              取消
            </button>
            <button
              className={dialog === "delete" ? "danger" : "primary"}
              type="submit"
            >
              {dialog === "delete" ? "确认删除" : "保存名称"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
