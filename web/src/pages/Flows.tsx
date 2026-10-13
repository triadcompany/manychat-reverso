import { useEffect, useState } from "react";
import { api } from "../api";

type Flow = { id: string; name: string; status: "DRAFT" | "LIVE" | "PAUSED"; updatedAt: string };
const LABEL = { DRAFT: "Rascunho", LIVE: "Ativo", PAUSED: "Pausado" };

export function Flows({ onOpen }: { onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<Flow[] | null>(null);
  const [name, setName] = useState("");
  const load = () => api<Flow[]>("/flows").then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  return (
    <>
      <form className="row" onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const f = await api<Flow>("/flows", { method: "POST", body: JSON.stringify({ name }) });
        setName(""); onOpen(f.id);
      }}>
        <input placeholder="Nome da nova automação" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn">Criar</button>
      </form>
      {rows === null ? <p className="muted">Carregando…</p> : rows.length === 0 ? <p className="muted">Nenhuma automação ainda.</p> : (
        <table>
          <thead><tr><th>Nome</th><th>Status</th><th>Atualizada</th></tr></thead>
          <tbody>{rows.map((f) => (
            <tr key={f.id} onClick={() => onOpen(f.id)} style={{ cursor: "pointer" }}>
              <td>{f.name}</td><td>{LABEL[f.status]}</td><td className="muted">{new Date(f.updatedAt).toLocaleString("pt-BR")}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </>
  );
}
