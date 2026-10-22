// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import Preview from "./Preview";
afterEach(cleanup);
it("渲染标题、表格、任务列表和代码块", () => {
  const { container } = render(
    <Preview
      content={
        "# 标题\n\n- [x] 完成\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n```js\nconst a = 1\n```"
      }
    />,
  );
  expect(screen.getByRole("heading").textContent).toBe("标题");
  expect(container.querySelector("table")).not.toBeNull();
  expect((container.querySelector("input") as HTMLInputElement).checked).toBe(
    true,
  );
  expect(container.querySelector("pre code")?.textContent).toContain(
    "const a = 1",
  );
});
it("原始 HTML 和危险链接无法执行，图片不发起外部请求", () => {
  const { container } = render(
    <Preview
      content={
        "<script>alert(1)</script>\n\n[危险](javascript:alert%281%29)\n\n![图片](https://example.com/track.png)\n\n[正常](https://example.com)"
      }
    />,
  );
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("img")).toBeNull();
  expect(screen.getByText("危险").getAttribute("href")).toBeNull();
  expect(
    screen.getByRole("link", { name: "正常" }).getAttribute("rel"),
  ).toContain("noopener");
});
