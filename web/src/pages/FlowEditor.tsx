import { addEdge, Background, Controls, Handle, Position, ReactFlow, useEdgesState, useNodesState, type Connection, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { useEffect, useState } from "react";
import { api } from "../api";

type NodeType = "trigger" | "message" | "condition" | "action" | "wait" | "end";
type Data = Record<string, any>;
type Flow = { id: string; name: string; status: "DRAFT" | "LIVE" | "PAUSED"; graph: { nodes: any[]; edges: any[] } };

const TITLES: Record<NodeType, string> = { trigger: "Gatilho", message: "Mensagem", condition: "Condição", action: "Ação", wait: "Espera", end: "Fim" };
const DEFAULTS: Record<NodeType, Data> = {
  trigger: { kind: "comment_keyword", keywords: [] },
  message: { text: "" },
  condition: { kind: "keyword", value: "" },
  action: { kind: "add_tag", tag: "" },
  wait: { seconds: 60 },
  end: {},
};

function summary(type: NodeType, d: Data) {
  if (type === "trigger") return d.kind === "default_reply" ? "Qualquer DM" : (d.keywords ?? []).join(", ") || "Sem palavra-chave";
  if (type === "message") return d.text || "Mensagem vazia";
  if (type === "condition") return `${d.kind}: ${d.value || "…"}`;
  if (type === "action") return `${d.kind}: ${d.tag || d.field || "…"}`;
  if (type === "wait") return `${d.seconds}s`;
  return "";
}

function FlowNodeView({ data, type, selected }: NodeProps) {
  const t = type as NodeType;
  return (
    <div style={{ background: "#fff", border: `1.5px solid ${selected ? "#1f5eff" : "#dcdcd6"}`, borderRadius: 8, padding: "8px 12px", minWidth: 160, fontSize: 13 }}>
      {t !== "trigger" && <Handle type="target" position={Position.Top} />}
      <b>{TITLES[t]}</b>
      <div className="muted" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summary(t, data as Data)}</div>
      {t === "condition" ? (
        <>
          <Handle type="source" id="true" position={Position.Bottom} style={{ left: "28%" }} />
          <Handle type="source" id="false" position={Position.Bottom} style={{ left: "72%" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }} className="muted"><span>sim</span><span>não</span></div>
        </>
      ) : t !== "end" && <Handle type="source" position={Position.Bottom} />}
    </div>
  );
}
const nodeTypes = Object.fromEntries((Object.keys(TITLES) as NodeType[]).map((k) => [k, FlowNodeView]));

export function FlowEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const [flow, setFlow] = useState<Flow | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    api<Flow>(`/flows/${id}`).then((f) => {
      setFlow(f);
      setNodes(f.graph.nodes.map((n) => ({ id: n.id, type: n.type, data: n.data, position: n.position ?? { x: 0, y: 0 } })));
      setEdges(f.graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.handle ?? null })));
    });
  }, [id]);

  const dirty = () => setSaved(false);
  const add = (t: NodeType) => { setNodes((ns) => [...ns, { id: crypto.randomUUID(), type: t, data: { ...DEFAULTS[t] }, position: { x: 80 + ns.length * 30, y: 60 + ns.length * 90 } }]); dirty(); };
  const connect = (c: Connection) => { setEdges((es) => addEdge(c, es)); dirty(); };
  const patch = (nid: string, d: Data) => { setNodes((ns) => ns.map((n) => (n.id === nid ? { ...n, data: { ...n.data, ...d } } : n))); dirty(); };
  const remove = (nid: string) => { setNodes((ns) => ns.filter((n) => n.id !== nid)); setEdges((es) => es.filter((e) => e.source !== nid && e.target !== nid)); setSel(null); dirty(); };

  const save = async (status?: Flow["status"]) => {
    const graph = {
      nodes: nodes.map((n) => ({ id: n.id, type: n.type, data: n.data, position: n.position })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, handle: e.sourceHandle ?? undefined })),
    };
    const f = await api<Flow>(`/flows/${id}`, { method: "PUT", body: JSON.stringify({ graph, ...(status ? { status } : {}) }) });
    setFlow((cur) => (cur ? { ...cur, status: f.status } : cur)); setSaved(true);
  };

  const node = nodes.find((n) => n.id === sel);
  if (!flow) return <p className="muted">Carregando…</p>;
  return (
    <>
      <div className="row">
        <button className="btn ghost" onClick={onBack}>← Voltar</button>
        <b>{flow.name}</b><span className="muted">{{ DRAFT: "Rascunho", LIVE: "Ativo", PAUSED: "Pausado" }[flow.status]}{saved ? "" : " · alterações não salvas"}</span>
        <span style={{ flex: 1 }} />
        {(Object.keys(TITLES) as NodeType[]).map((t) => <button key={t} className="btn ghost" onClick={() => add(t)}>+ {TITLES[t]}</button>)}
        <button className="btn" onClick={() => save()}>Salvar</button>
        <button className="btn" onClick={() => save(flow.status === "LIVE" ? "PAUSED" : "LIVE")}>{flow.status === "LIVE" ? "Pausar" : "Ativar"}</button>
      </div>
      <div className="editor">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={(c) => { onNodesChange(c); if (c.some((x) => x.type === "position" || x.type === "remove")) dirty(); }}
          onEdgesChange={(c) => { onEdgesChange(c); if (c.some((x) => x.type === "remove")) dirty(); }} onConnect={connect}
          onNodeClick={(_, n) => setSel(n.id)} onPaneClick={() => setSel(null)} fitView>
          <Background /><Controls />
        </ReactFlow>
        <div className="panel">
          {!node ? <p className="muted">Selecione um bloco para editar.</p> : <NodeForm node={node} patch={(d) => patch(node.id, d)} remove={() => remove(node.id)} />}
        </div>
      </div>
    </>
  );
}

function NodeForm({ node, patch, remove }: { node: Node; patch: (d: Data) => void; remove: () => void }) {
  const t = node.type as NodeType, d = node.data as Data;
  const text = (label: string, key: string, area = false) => (
    <><label>{label}</label>{area ? <textarea rows={4} style={{ width: "100%", font: "inherit" }} value={d[key] ?? ""} onChange={(e) => patch({ [key]: e.target.value })} /> : <input value={d[key] ?? ""} onChange={(e) => patch({ [key]: e.target.value })} />}</>
  );
  return (
    <>
      <b>{TITLES[t]}</b>
      {t === "trigger" && (<>
        <label>Tipo</label>
        <select value={d.kind} onChange={(e) => patch({ kind: e.target.value })}>
          <option value="comment_keyword">Comentário com palavra-chave</option><option value="dm_keyword">DM com palavra-chave</option><option value="default_reply">Resposta padrão (qualquer DM)</option>
        </select>
        {d.kind !== "default_reply" && (<><label>Palavras-chave (separe por vírgula)</label><input value={(d.keywords ?? []).join(", ")} onChange={(e) => patch({ keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></>)}
        {d.kind === "comment_keyword" && text("ID da publicação (opcional)", "postId")}
      </>)}
      {t === "message" && (<>{text("Texto", "text", true)}
        <label>Botão de link (rótulo e URL)</label>
        <input placeholder="Rótulo" value={d.buttons?.[0]?.label ?? ""} onChange={(e) => patch({ buttons: [{ ...d.buttons?.[0], label: e.target.value }] })} />
        <input placeholder="https://…" style={{ marginTop: 6 }} value={d.buttons?.[0]?.url ?? ""} onChange={(e) => patch({ buttons: [{ ...d.buttons?.[0], label: d.buttons?.[0]?.label ?? "", url: e.target.value }] })} />
      </>)}
      {t === "condition" && (<>
        <label>Tipo</label>
        <select value={d.kind} onChange={(e) => patch({ kind: e.target.value })}><option value="keyword">Resposta contém</option><option value="has_tag">Tem a tag</option><option value="field_equals">Campo igual a</option></select>
        {d.kind === "field_equals" && text("Campo", "field")}{text("Valor", "value")}
      </>)}
      {t === "action" && (<>
        <label>Ação</label>
        <select value={d.kind} onChange={(e) => patch({ kind: e.target.value })}><option value="add_tag">Adicionar tag</option><option value="remove_tag">Remover tag</option><option value="set_field">Definir campo</option></select>
        {d.kind === "set_field" ? <>{text("Campo", "field")}{text("Valor", "value")}</> : text("Tag", "tag")}
      </>)}
      {t === "wait" && (<><label>Segundos</label><input type="number" min={1} value={d.seconds} onChange={(e) => patch({ seconds: Math.max(1, Number(e.target.value)) })} /></>)}
      <div style={{ marginTop: 16 }}><button className="btn ghost" onClick={remove}>Remover bloco</button></div>
    </>
  );
}
