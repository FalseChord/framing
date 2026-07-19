"use client";

import { useEffect, useState } from "react";

interface UserItem {
  id: string;
  name: string;
  signature: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [signature, setSignature] = useState("");

  async function load() {
    const res = await fetch("/api/users");
    setUsers(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(u: UserItem) {
    setEditingId(u.id);
    setName(u.name);
    setSignature(u.signature);
  }

  function cancelEdit() {
    setEditingId(null);
    setName("");
    setSignature("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editingId ? `/api/users/${editingId}` : "/api/users";
    const method = editingId ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, signature }),
    });
    setEditingId(null);
    setName("");
    setSignature("");
    await load();
  }

  return (
    <main>
      <h1>操作者名單管理</h1>
      <ul>
        {users.map((u) => (
          <li key={u.id}>
            {u.name}（簽名代號：{u.signature}）
            <button type="button" onClick={() => startEdit(u)}>
              編輯
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <h2>{editingId ? "編輯操作者" : "新增操作者"}</h2>
        <label>
          姓名
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          簽名代號
          <input value={signature} onChange={(e) => setSignature(e.target.value)} required />
        </label>
        <button type="submit">{editingId ? "儲存修改" : "新增操作者"}</button>
        {editingId && (
          <button type="button" onClick={cancelEdit}>
            取消編輯
          </button>
        )}
      </form>
    </main>
  );
}
