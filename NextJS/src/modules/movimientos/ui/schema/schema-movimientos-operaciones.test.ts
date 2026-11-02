import { describe, expect, it } from "vitest";
import { schemaChangeCodeUI } from "./schema-cambiar-cargo";
import { schemaStatusChangeUI } from "./schema-cambiar-estatus";
import { schemaPasivoUI } from "./schema-cambiar-pasivo";

describe("Schemas de Operaciones de Movimientos", () => {
  describe("schemaChangeCodeUI", () => {
    it("valida payload correcto para cambio de cargo", () => {
      const res = schemaChangeCodeUI.safeParse({
        code_old: 10,
        nuevo_cargo_id: 20,
        motivo: 1,
      });
      expect(res.success).toBe(true);
    });

    it("falla si code_old no es seleccionado", () => {
      const res = schemaChangeCodeUI.safeParse({
        code_old: 0,
        nuevo_cargo_id: 20,
        motivo: 1,
      });
      expect(res.success).toBe(false);
    });

    it("falla si nuevo_cargo_id no es seleccionado", () => {
      const res = schemaChangeCodeUI.safeParse({
        code_old: 10,
        nuevo_cargo_id: 0,
        motivo: 1,
      });
      expect(res.success).toBe(false);
    });

    it("falla si motivo es cero o negativo", () => {
      const res = schemaChangeCodeUI.safeParse({
        code_old: 10,
        nuevo_cargo_id: 20,
        motivo: 0,
      });
      expect(res.success).toBe(false);
    });
  });

  describe("schemaStatusChangeUI", () => {
    it("valida payload correcto para cambio de estatus", () => {
      const res = schemaStatusChangeUI.safeParse({
        cargo: 5,
        estatus_id: 2,
        motivo: 3,
      });
      expect(res.success).toBe(true);
    });

    it("falla si cargo no es válido", () => {
      const res = schemaStatusChangeUI.safeParse({
        cargo: 0,
        estatus_id: 2,
        motivo: 3,
      });
      expect(res.success).toBe(false);
    });

    it("falla si estatus_id no es válido", () => {
      const res = schemaStatusChangeUI.safeParse({
        cargo: 5,
        estatus_id: 0,
        motivo: 3,
      });
      expect(res.success).toBe(false);
    });

    it("falla si motivo no es válido", () => {
      const res = schemaStatusChangeUI.safeParse({
        cargo: 5,
        estatus_id: 2,
        motivo: 0,
      });
      expect(res.success).toBe(false);
    });
  });

  describe("schemaPasivoUI", () => {
    it("valida payload correcto para pasivo con nómina", () => {
      const res = schemaPasivoUI.safeParse({
        estatus_id: 1,
        motivo: 2,
        tiponominaid: 4,
        liberar_activos: true,
      });
      expect(res.success).toBe(true);
    });

    it("aplica valores por defecto para tiponominaid y liberar_activos", () => {
      const res = schemaPasivoUI.safeParse({
        estatus_id: 1,
        motivo: 2,
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.tiponominaid).toBe(0);
        expect(res.data.liberar_activos).toBe(false);
      }
    });

    it("falla si estatus_id es cero", () => {
      const res = schemaPasivoUI.safeParse({
        estatus_id: 0,
        motivo: 2,
      });
      expect(res.success).toBe(false);
    });

    it("falla si motivo es cero", () => {
      const res = schemaPasivoUI.safeParse({
        estatus_id: 1,
        motivo: 0,
      });
      expect(res.success).toBe(false);
    });
  });
});
