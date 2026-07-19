import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import styles from "./AppNav.module.css";

const NAV_LINKS = [
  { href: "/generate", label: "產生信件" },
  { href: "/templates", label: "模板管理" },
  { href: "/therapists", label: "心理師管理" },
  { href: "/users", label: "操作者管理" },
];

export default async function AppNav() {
  const session = await getSession();

  return (
    <header className={styles.nav}>
      <div className={styles.navInner}>
        <Link href="/" className={styles.brand}>
          信件模板系統
        </Link>
        <nav className={styles.links}>
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={styles.link}>
              {link.label}
            </Link>
          ))}
        </nav>
        {session.name && (
          <span className={styles.identity}>
            目前操作者：{session.name}（{session.signature}）
          </span>
        )}
      </div>
    </header>
  );
}
