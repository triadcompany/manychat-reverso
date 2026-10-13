import { useState } from "react";
import { api, getToken, setToken } from "./api";
import { Contacts } from "./pages/Contacts";
import { FlowEditor } from "./pages/FlowEditor";
import { Flows } from "./pages/Flows";

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(false);
  return (
    <form className="login" onSubmit={async (e) => {
      e.preventDefault();
      try { setToken((await api<{ token: string }>("/auth/login", { method: "POST", body: JSON.stringify({ password }) })).token); onDone(); }
      catch { setErr(true); }
    }}>
      <b>Entrar</b>
      <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
      {err && <span className="muted">Senha incorreta.</span>}
      <button className="btn">Entrar</button>
    </form>
  );
}

export function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [tab, setTab] = useState<"contacts" | "flows">("flows");
  const [flowId, setFlowId] = useState<string | null>(null);
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  return (
    <>
      <header>
        <b>Fluxos</b>
        <button className={tab === "flows" ? "on" : ""} onClick={() => { setTab("flows"); setFlowId(null); }}>Automações</button>
        <button className={tab === "contacts" ? "on" : ""} onClick={() => setTab("contacts")}>Contatos</button>
        <span style={{ flex: 1 }} />
        <button onClick={() => { setToken(null); setAuthed(false); }}>Sair</button>
      </header>
      <main>
        {tab === "contacts" && <Contacts />}
        {tab === "flows" && (flowId ? <FlowEditor id={flowId} onBack={() => setFlowId(null)} /> : <Flows onOpen={setFlowId} />)}
      </main>
    </>
  );
}
