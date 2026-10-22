import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { safeUrl } from "./store";
export default function Preview({ content }: { content: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      urlTransform={safeUrl}
      components={{
        a: ({ children, href }) => (
          <a href={href || undefined} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        img: ({ alt }) => (
          <span className="image-placeholder">
            图片：{alt || "未命名"}（外部图片不自动加载）
          </span>
        ),
      }}
    >
      {content}
    </Markdown>
  );
}
