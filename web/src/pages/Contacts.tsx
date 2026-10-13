import { useEffect, useState } from "react";
import { api } from "../api";

type Contact = { id: string; name?: string; username?: string; externalId: string; channel: { type: string }; tags: { tag: { name: string } }[]; lastSeenAt: string };

export function Contacts() {
  const [rows, setRows] = useState<Contact[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => { api<Contact[]>("/contacts").then(setRows).catch(() => setRows([])); }, []);
  const shown = (rows ?? []).filter((c) => `${c.name ?? ""} ${c.username ?? ""} ${c.externalId}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div className="row"><input placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {rows === null ? <p className="muted">Carregando…</p> : shown.length === 0 ? <p className="muted">Nenhum contato ainda.</p> : (
        <table>
          <thead><tr><th>Contato</th><th>Canal</th><th>Tags</th><th>Última atividade</th></tr></thead>
          <tbody>{shown.map((c) => (
            <tr key={c.id}>
              <td>{c.name || c.username || c.externalId}</td>
              <td>{c.channel.type === "INSTAGRAM" ? "Instagram" : "WhatsApp"}</td>
              <td>{c.tags.map((t) => <span className="tag" key={t.tag.name}>{t.tag.name}</span>)}</td>
              <td className="muted">{new Date(c.lastSeenAt).toLocaleString("pt-BR")}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </>
  );
}
