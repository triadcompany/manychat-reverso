import { describe, expect, it } from "vitest";
import { toE164Brazil, toWhatsAppSendFormat } from "./phone.js";

describe("telefone BR", () => {
  it("normaliza para E.164", () => {
    expect(toE164Brazil("+55 (47) 99655-0132")).toBe("5547996550132");
    expect(toE164Brazil("(47) 99655-0132")).toBe("5547996550132");
  });
  it("remove o nono dígito no envio", () => {
    expect(toWhatsAppSendFormat("+55 (47) 996550132")).toBe("554796550132");
  });
  it("não mexe em número que já está sem o 9", () => {
    expect(toWhatsAppSendFormat("554796550132")).toBe("554796550132");
  });
});
