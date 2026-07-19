"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface UserItem {
  id: string;
  name: string;
}

export default function SelectIdentityPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then(setUsers);
  }, []);

  async function handleSelect(userId: string) {
    setError("");
    const res = await fetch("/api/auth/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      setError("選擇失敗，請重新整理後再試");
      return;
    }
    router.push("/");
  }

  return (
    <main className="page-container" style={{ maxWidth: "480px" }}>
      <h1>請選擇目前操作者</h1>
      {error && <p role="alert">{error}</p>}
      <ul className="list">
        {users.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              className="button button-primary"
              onClick={() => handleSelect(u.id)}
              style={{ width: "100%", margin: 0 }}
            >
              {u.name}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
