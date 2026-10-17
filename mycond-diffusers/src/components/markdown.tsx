import { Fragment } from "react";

/** Мінімальний рендер: «## заголовок», абзаци, «- список», **жирний** */
function inline(text: string) {
  return text.split(/(\*\*.+?\*\*)/g).map((part, i) =>
    part.length > 4 && part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

export function Markdown({ source }: { source: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={blocks.length}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>);
    list = [];
  };
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("- ")) {
      list.push(line.slice(2));
      continue;
    }
    flush();
    if (!line) continue;
    if (line.startsWith("## ")) blocks.push(<h2 key={blocks.length}>{line.slice(3)}</h2>);
    else blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <div className="prose-md">{blocks}</div>;
}
