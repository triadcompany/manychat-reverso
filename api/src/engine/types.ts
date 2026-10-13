export type NodeType = "trigger" | "message" | "condition" | "action" | "wait" | "end";

export type Button = { label: string; url?: string; payload?: string };

export type FlowNode =
  | { id: string; type: "trigger"; data: { kind: "comment_keyword" | "dm_keyword" | "default_reply"; keywords?: string[]; postId?: string } }
  | { id: string; type: "message"; data: { text?: string; buttons?: Button[]; fileUrl?: string } }
  | { id: string; type: "condition"; data: { kind: "keyword" | "has_tag" | "field_equals"; value: string; field?: string } }
  | { id: string; type: "action"; data: { kind: "add_tag" | "remove_tag" | "set_field"; tag?: string; field?: string; value?: string } }
  | { id: string; type: "wait"; data: { seconds: number } }
  | { id: string; type: "end"; data: Record<string, never> };

// `handle` distingue saídas de um nó (condição: "true" | "false").
export type FlowEdge = { id: string; source: string; target: string; handle?: string };

export type FlowGraph = { nodes: FlowNode[]; edges: FlowEdge[] };

export type ContactState = { tags: string[]; fields: Record<string, string> };

// Efeitos colaterais ficam atrás desta interface para o motor ser testável sem rede nem banco.
export interface Effects {
  sendMessage(msg: { text?: string; buttons?: Button[]; fileUrl?: string }): Promise<void>;
  addTag(tag: string): Promise<void>;
  removeTag(tag: string): Promise<void>;
  setField(field: string, value: string): Promise<void>;
}

export type StepResult =
  | { status: "done" }
  | { status: "waiting"; nodeId: string; resumeAt?: Date };
