import { describe, expect, it } from "vitest";
import { findTrigger, matchesKeyword, runFrom } from "./engine.js";
import type { Effects, FlowGraph } from "./types.js";

const fx = () => {
  const log: string[] = [];
  const effects: Effects = {
    sendMessage: async (m) => void log.push(`msg:${m.text}`),
    addTag: async (t) => void log.push(`tag+:${t}`),
    removeTag: async (t) => void log.push(`tag-:${t}`),
    setField: async (f, v) => void log.push(`set:${f}=${v}`),
  };
  return { log, effects };
};

const graph: FlowGraph = {
  nodes: [
    { id: "t", type: "trigger", data: { kind: "comment_keyword", keywords: ["preço"] } },
    { id: "m1", type: "message", data: { text: "oi" } },
    { id: "c", type: "condition", data: { kind: "has_tag", value: "vip" } },
    { id: "m2", type: "message", data: { text: "vip" } },
    { id: "a", type: "action", data: { kind: "add_tag", tag: "lead" } },
    { id: "w", type: "wait", data: { seconds: 60 } },
    { id: "m3", type: "message", data: { text: "depois" } },
  ],
  edges: [
    { id: "1", source: "t", target: "m1" },
    { id: "2", source: "m1", target: "c" },
    { id: "3", source: "c", target: "m2", handle: "true" },
    { id: "4", source: "c", target: "a", handle: "false" },
    { id: "5", source: "a", target: "w" },
    { id: "6", source: "w", target: "m3" },
  ],
};

describe("engine", () => {
  it("ignora acento e caixa no gatilho", () => {
    expect(matchesKeyword("Qual o PRECO?", ["preço"])).toBe(true);
    expect(matchesKeyword("oi", ["preço"])).toBe(false);
  });

  it("acha o gatilho de comentário", () => {
    expect(findTrigger(graph, { kind: "comment", text: "preço?" })?.id).toBe("t");
    expect(findTrigger(graph, { kind: "dm", text: "preço?" })).toBeUndefined();
  });

  it("segue o ramo falso, marca tag e para na espera", async () => {
    const { log, effects } = fx();
    const res = await runFrom(graph, "t", { tags: [], fields: {} }, effects);
    expect(log).toEqual(["msg:oi", "tag+:lead"]);
    expect(res.status).toBe("waiting");
    expect(res.status === "waiting" && res.nodeId).toBe("m3");
  });

  it("segue o ramo verdadeiro quando tem a tag", async () => {
    const { log, effects } = fx();
    await runFrom(graph, "t", { tags: ["vip"], fields: {} }, effects);
    expect(log).toEqual(["msg:oi", "msg:vip"]);
  });

  it("não entra em loop infinito", async () => {
    const loop: FlowGraph = {
      nodes: [{ id: "a", type: "message", data: { text: "x" } }],
      edges: [{ id: "e", source: "a", target: "a" }],
    };
    const { log, effects } = fx();
    await runFrom(loop, "a", { tags: [], fields: {} }, effects);
    expect(log.length).toBe(100);
  });
});
