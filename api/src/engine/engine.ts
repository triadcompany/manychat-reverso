import type { ContactState, Effects, FlowEdge, FlowGraph, FlowNode, StepResult } from "./types.js";

const MAX_STEPS = 100; // trava contra ciclos no grafo

export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function matchesKeyword(text: string, keywords: string[]): boolean {
  const t = normalize(text);
  return keywords.some((k) => k.trim() !== "" && t.includes(normalize(k)));
}

function nextNode(graph: FlowGraph, from: string, handle?: string): FlowNode | undefined {
  const edge: FlowEdge | undefined = graph.edges.find(
    (e) => e.source === from && (handle === undefined || (e.handle ?? undefined) === handle),
  );
  return edge && graph.nodes.find((n) => n.id === edge.target);
}

function evalCondition(node: Extract<FlowNode, { type: "condition" }>, state: ContactState, inbound?: string) {
  const { kind, value, field } = node.data;
  if (kind === "keyword") return inbound !== undefined && matchesKeyword(inbound, value.split(","));
  if (kind === "has_tag") return state.tags.includes(value);
  return field !== undefined && state.fields[field] === value;
}

/** Executa o grafo a partir de `startId` até acabar ou parar em uma espera. */
export async function runFrom(
  graph: FlowGraph,
  startId: string,
  state: ContactState,
  fx: Effects,
  inbound?: string,
): Promise<StepResult> {
  let node: FlowNode | undefined = graph.nodes.find((n) => n.id === startId);
  for (let steps = 0; node && steps < MAX_STEPS; steps++) {
    switch (node.type) {
      case "trigger":
        node = nextNode(graph, node.id);
        break;
      case "message":
        await fx.sendMessage(node.data);
        node = nextNode(graph, node.id);
        break;
      case "action": {
        const { kind, tag, field, value } = node.data;
        if (kind === "add_tag" && tag) { await fx.addTag(tag); if (!state.tags.includes(tag)) state.tags.push(tag); }
        if (kind === "remove_tag" && tag) { await fx.removeTag(tag); state.tags = state.tags.filter((t) => t !== tag); }
        if (kind === "set_field" && field) { await fx.setField(field, value ?? ""); state.fields[field] = value ?? ""; }
        node = nextNode(graph, node.id);
        break;
      }
      case "condition":
        node = nextNode(graph, node.id, evalCondition(node, state, inbound) ? "true" : "false");
        break;
      case "wait": {
        const after = nextNode(graph, node.id);
        return after
          ? { status: "waiting", nodeId: after.id, resumeAt: new Date(Date.now() + node.data.seconds * 1000) }
          : { status: "done" };
      }
      case "end":
        return { status: "done" };
    }
  }
  return { status: "done" };
}

/** Acha o gatilho que dispara para um evento recebido. */
export function findTrigger(
  graph: FlowGraph,
  event: { kind: "comment" | "dm"; text: string; postId?: string },
): FlowNode | undefined {
  return graph.nodes.find((n) => {
    if (n.type !== "trigger") return false;
    const d = n.data;
    if (d.kind === "default_reply") return event.kind === "dm";
    if (d.kind === "comment_keyword") {
      if (event.kind !== "comment") return false;
      if (d.postId && d.postId !== event.postId) return false;
      return matchesKeyword(event.text, d.keywords ?? []);
    }
    return event.kind === "dm" && matchesKeyword(event.text, d.keywords ?? []);
  });
}
