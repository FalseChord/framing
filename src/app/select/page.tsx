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
    <main>
      <h1>請選擇目前操作者</h1>
      {error && <p role="alert">{error}</p>}
      <ul>
        {users.map((u) => (
          <li key={u.id}>
            <button onClick={() => handleSelect(u.id)}>{u.name}</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
