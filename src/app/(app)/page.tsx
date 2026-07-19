import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>信件模板系統</h1>
      <p>本機測試階段</p>
      <ul>
        <li>
          <Link href="/generate">產生信件</Link>
        </li>
        <li>
          <Link href="/templates">模板管理</Link>
        </li>
        <li>
          <Link href="/therapists">心理師名單管理</Link>
        </li>
        <li>
          <Link href="/users">操作者名單管理</Link>
        </li>
      </ul>
    </main>
  );
}
