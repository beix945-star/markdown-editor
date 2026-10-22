// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import { createStore, KEY } from "./store";
// jsdom does not implement native dialog interactions.
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};
afterEach(cleanup);
it("用户新建、输入、预览、搜索、重命名、切换、删除并刷新恢复", async () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
  const store = createStore(storage);
  const user = userEvent.setup();
  const view = render(<App store={store} />);
  await user.click(screen.getByRole("button", { name: "＋ 新建文档" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Markdown 正文" }), {
    target: { value: "# 我的笔记\n正文" },
  });
  expect(screen.getByRole("heading", { name: "我的笔记" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "重命名" }));
  const name = screen.getByLabelText("文档名称");
  await user.clear(name);
  await user.type(name, "学习记录");
  await user.click(screen.getByRole("button", { name: "保存名称" }));
  await user.type(
    screen.getByRole("textbox", { name: "搜索文档" }),
    "没有匹配",
  );
  expect(screen.getByText("没有找到匹配的文档")).toBeTruthy();
  await user.clear(screen.getByRole("textbox", { name: "搜索文档" }));
  await user.click(
    within(screen.getByRole("navigation")).getByRole("button", {
      name: /开始使用纸间/,
    }),
  );
  await user.click(
    within(screen.getByRole("navigation")).getByRole("button", {
      name: /学习记录/,
    }),
  );
  expect(
    (
      screen.getByRole("textbox", {
        name: "Markdown 正文",
      }) as HTMLTextAreaElement
    ).value,
  ).toBe("# 我的笔记\n正文");
  await user.click(screen.getByRole("button", { name: "删除" }));
  await user.click(screen.getByRole("button", { name: "取消" }));
  expect(screen.getByRole("heading", { name: "学习记录" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "删除" }));
  await user.click(screen.getByRole("button", { name: "确认删除" }));
  view.unmount();
  store.dispose();
  const restored = createStore(storage);
  expect(restored.getSnapshot().docs).toHaveLength(1);
  expect(data.has(KEY)).toBe(true);
  restored.dispose();
});
it("保存失败提示用户，文字仍留在编辑区", async () => {
  const store = createStore({
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    },
  });
  render(<App store={store} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Markdown 正文" }), {
    target: { value: "重要内容" },
  });
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("自动保存失败"),
  );
  expect(
    (
      screen.getByRole("textbox", {
        name: "Markdown 正文",
      }) as HTMLTextAreaElement
    ).value,
  ).toBe("重要内容");
  cleanup();
  store.dispose();
});
it("Markdown 导出使用文档名称与原始正文", async () => {
  const store = createStore({ getItem: () => null, setItem: () => {} });
  store.add("导出测试", "# 内容");
  const create = vi.fn((_blob: Blob) => "blob:test");
  const revoke = vi.fn();
  vi.stubGlobal(
    "URL",
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }),
  );
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("导出测试.md");
    });
  render(<App store={store} />);
  await userEvent.click(screen.getByRole("button", { name: "↓ 导出 .md" }));
  expect(create.mock.calls[0][0]).toBeInstanceOf(Blob);
  expect(click).toHaveBeenCalledOnce();
  click.mockRestore();
  cleanup();
  store.dispose();
  vi.unstubAllGlobals();
});
