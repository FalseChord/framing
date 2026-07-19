"use client";

import { useEffect, useState } from "react";

interface TherapistItem {
  id: string;
  name: string;
  isActive: boolean;
  email: string | null;
  note: string | null;
}

export default function TherapistsPage() {
  const [therapists, setTherapists] = useState<TherapistItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [isActive, setIsActive] = useState(true);

  async function load() {
    const res = await fetch("/api/therapists?includeInactive=true");
    setTherapists(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(t: TherapistItem) {
    setEditingId(t.id);
    setName(t.name);
    setEmail(t.email ?? "");
    setNote(t.note ?? "");
    setIsActive(t.isActive);
  }

  function cancelEdit() {
    setEditingId(null);
    setName("");
    setEmail("");
    setNote("");
    setIsActive(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editingId ? `/api/therapists/${editingId}` : "/api/therapists";
    const method = editingId ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, note, isActive }),
    });
    setEditingId(null);
    setName("");
    setEmail("");
    setNote("");
    setIsActive(true);
    await load();
  }

  return (
    <main>
      <h1>心理師名單管理</h1>
      <ul>
        {therapists.map((t) => (
          <li key={t.id}>
            {t.name}
            {!t.isActive && "（已停用）"}
            {t.email && ` · ${t.email}`}
            {t.note && ` · ${t.note}`}
            <button type="button" onClick={() => startEdit(t)}>
              編輯
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <h2>{editingId ? "編輯心理師" : "新增心理師"}</h2>
        <label>
          姓名
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Email（選填）
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          備註（選填）
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {editingId && (
          <label>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            啟用中（取消勾選可停用，不會出現在產信下拉選單）
          </label>
        )}
        <button type="submit">{editingId ? "儲存修改" : "新增心理師"}</button>
        {editingId && (
          <button type="button" onClick={cancelEdit}>
            取消編輯
          </button>
        )}
      </form>
    </main>
  );
}
