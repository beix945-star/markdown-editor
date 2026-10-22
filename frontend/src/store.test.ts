import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createStore,
  decode,
  filename,
  KEY,
  readMarkdown,
  safeUrl,
} from "./store";
describe("文档保存与恢复", () => {
  let data: Map<string, string>;
  beforeEach(() => {
    vi.useFakeTimers();
    data = new Map();
  });
  afterEach(() => vi.useRealTimers());
  const port = () => ({
    getItem: (k: string) => data.get(k) ?? null,
    setItem: vi.fn((k: string, v: string) => {
      data.set(k, v);
    }),
  });
  it("连续输入防抖，只保存最终内容", () => {
    const storage = port();
    const s = createStore(storage);
    const id = s.getSnapshot().activeId;
    s.edit(id, "a");
    vi.advanceTimersByTime(300);
    s.edit(id, "ab");
    vi.advanceTimersByTime(300);
    expect(storage.setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(decode(data.get(KEY)!).docs[0].content).toBe("ab");
    s.dispose();
  });
  it("快速切换文档、继续编辑和刷新，不会写错文档", () => {
    const storage = port();
    const s = createStore(storage);
    const first = s.getSnapshot().activeId;
    s.edit(first, "第一篇");
    s.add("第二篇");
    const second = s.getSnapshot().activeId;
    s.edit(second, "第二篇内容");
    s.select(first);
    vi.runAllTimers();
    const restored = createStore(storage);
    expect(
      restored.getSnapshot().docs.find((d) => d.id === first)?.content,
    ).toBe("第一篇");
    expect(
      restored.getSnapshot().docs.find((d) => d.id === second)?.content,
    ).toBe("第二篇内容");
    expect(restored.getSnapshot().activeId).toBe(first);
    s.dispose();
    restored.dispose();
  });
  it("写入失败保留内容，重试后恢复", () => {
    const storage = port();
    storage.setItem.mockImplementationOnce(() => {
      throw new Error("quota");
    });
    const s = createStore(storage);
    s.edit(s.getSnapshot().activeId, "不能丢失");
    vi.runAllTimers();
    expect(s.getSnapshot().status).toBe("error");
    expect(s.getSnapshot().docs[0].content).toBe("不能丢失");
    s.flush();
    expect(s.getSnapshot().status).toBe("saved");
    s.dispose();
  });
  it("损坏的数据和未知版本不会被自动覆盖", () => {
    for (const raw of [
      "invalid",
      JSON.stringify({ version: 99, docs: [], activeId: "" }),
    ]) {
      data.set(KEY, raw);
      const storage = port();
      const s = createStore(storage);
      s.edit(s.getSnapshot().activeId, "临时内容");
      s.flush();
      vi.runAllTimers();
      expect(s.getSnapshot().blocked).toBe(true);
      expect(data.get(KEY)).toBe(raw);
      s.dispose();
    }
  });
  it("外部标签页修改后暂停覆盖，并保留当前编辑", () => {
    const storage = port();
    const s = createStore(storage);
    s.edit(s.getSnapshot().activeId, "草稿");
    s.externalChange();
    vi.runAllTimers();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(s.getSnapshot().docs[0].content).toBe("草稿");
    s.dispose();
  });
  it("重命名验证、删除最后一篇与空列表刷新", () => {
    const storage = port();
    const s = createStore(storage);
    const id = s.getSnapshot().activeId;
    expect(() => s.rename(id, " ")).toThrow();
    s.rename(id, "新名字");
    s.flush();
    expect(createStore(storage).getSnapshot().docs[0].title).toBe("新名字");
    s.remove(id);
    expect(createStore(storage).getSnapshot().docs).toEqual([]);
    s.dispose();
  });
});
describe("安全预览与导入导出", () => {
  it("拒绝脚本、data、相对协议和混淆链接", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,x",
      "//example.com",
      "java\nscript:x",
      "https://a\nb",
    ])
      expect(safeUrl(url)).toBe("");
    for (const url of [
      "https://example.com",
      "mailto:a@example.com",
      "#heading",
    ])
      expect(safeUrl(url)).toBe(url);
  });
  it("导出文件名不能包含路径字符", () => {
    expect(filename("../a/b:*")).toBe(".._a_b__.md");
    expect(filename("...")).toBe("文档.md");
  });
  it("校验导入大小、扩展名、UTF-8 和二进制内容", async () => {
    const file = (name: string, text: string, size?: number) =>
      ({
        name,
        size: size ?? text.length,
        arrayBuffer: async () => new TextEncoder().encode(text).buffer,
      }) as File;
    await expect(readMarkdown(file("hello.md", "# hello"))).resolves.toEqual({
      title: "hello",
      content: "# hello",
    });
    await expect(readMarkdown(file("x.exe", ""))).rejects.toThrow(".md");
    await expect(
      readMarkdown(file("x.md", "", 1024 * 1024 + 1)),
    ).rejects.toThrow("1 MB");
    await expect(readMarkdown(file("x.md", "\0"))).rejects.toThrow("非文本");
    await expect(
      readMarkdown({
        name: "x.md",
        size: 1,
        arrayBuffer: async () => new Uint8Array([255]).buffer,
      } as File),
    ).rejects.toThrow("UTF-8");
  });
});

it("恢复备份保留原文档，并为副本分配新 ID", () => {
  const data = new Map<string, string>();
  const store = createStore({
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
  });
  const original = store.getSnapshot().docs[0];
  store.importBackup([original]);
  const docs = store.getSnapshot().docs;
  expect(docs).toHaveLength(2);
  expect(docs[0].id).not.toBe(original.id);
  expect(docs[0].content).toBe(original.content);
  expect(docs[1].id).toBe(original.id);
  expect(decode(data.get(KEY)!).docs).toHaveLength(2);
  store.dispose();
});
