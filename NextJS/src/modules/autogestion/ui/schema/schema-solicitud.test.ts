import { describe, expect, it } from "vitest";
import {
  antecedenteSchema,
  contactoSchema,
  contactoEmergenciaSchema,
  complementariaSchema,
  esquemaDeEntidad,
  familiarSchema,
  formacionSchema,
  habilitarVentanaSchema,
  identidadSchema,
  perfilFisicoSchema,
  perfilSaludSchema,
  prorrogaSchema,
  devolucionSchema,
  rechazoSchema,
  solicitudNuevaSchema,
  viviendaSchema,
} from "./schema-solicitud";

describe("solicitudNuevaSchema", () => {
  const motivo = "Cambié de número de teléfono móvil";
  it("exige al menos un campo y un motivo de 5 palabras y 20 caracteres", () => {
    expect(solicitudNuevaSchema.safeParse({ campos: [], motivo }).success).toBe(false);
    expect(
      solicitudNuevaSchema.safeParse({ campos: ["employee.telefono_movil"], motivo: "  " }).success,
    ).toBe(false);
    expect(
      solicitudNuevaSchema.safeParse({
        campos: ["employee.telefono_movil"],
        motivo: "Cambié de número",
      }).success,
    ).toBe(false); // 3 palabras
    expect(
      solicitudNuevaSchema.safeParse({ campos: ["employee.telefono_movil"], motivo: "a b c d e" })
        .success,
    ).toBe(false); // 5 palabras pero menos de 20 caracteres
    expect(
      solicitudNuevaSchema.safeParse({ campos: ["employee.telefono_movil"], motivo }).success,
    ).toBe(true);
  });
  it("acepta acciones de secciones de lista y rechaza las inventadas", () => {
    const base = { motivo };
    expect(
      solicitudNuevaSchema.safeParse({ ...base, campos: ["familiar.@CREAR", "familiar.@ELIMINAR"] })
        .success,
    ).toBe(true);
    expect(solicitudNuevaSchema.safeParse({ ...base, campos: ["familiar.@BORRAR"] }).success).toBe(
      false,
    );
    expect(solicitudNuevaSchema.safeParse({ ...base, campos: ["employee.@CREAR"] }).success).toBe(
      false,
    );
  });
  it("rechaza campos desconocidos (el correo institucional), HTML y motivos largos", () => {
    expect(solicitudNuevaSchema.safeParse({ campos: ["employee.correo"], motivo }).success).toBe(
      false,
    );
    expect(
      solicitudNuevaSchema.safeParse({
        campos: ["employee.profile"],
        motivo: "<b>cambio de foto de perfil</b>",
      }).success,
    ).toBe(false);
    expect(
      solicitudNuevaSchema.safeParse({ campos: ["employee.profile"], motivo: "a ".repeat(260) })
        .success,
    ).toBe(false);
  });
  it("el correo alternativo sí es solicitable", () => {
    expect(
      solicitudNuevaSchema.safeParse({
        campos: ["datos_complementarios.correo_alternativo"],
        motivo,
      }).success,
    ).toBe(true);
  });
});

describe("contactoSchema", () => {
  it("acepta teléfonos y correo alternativo válidos o vacíos", () => {
    expect(
      contactoSchema.safeParse({ telefono_movil: "0412-1234567", correo_alternativo: "a@b.co" })
        .success,
    ).toBe(true);
    expect(
      contactoSchema.safeParse({
        telefono_movil: "",
        telefono_habitacion: "",
        correo_alternativo: "",
      }).success,
    ).toBe(true);
  });
  it("rechaza teléfono y correo con formato inválido", () => {
    expect(contactoSchema.safeParse({ telefono_movil: "abc" }).success).toBe(false);
    const r = contactoSchema.safeParse({ correo_alternativo: "sin-arroba" });
    expect(r.success).toBe(false);
  });
});

describe("teléfonos con código de país (D-13)", () => {
  it("el móvil exige móvil y la habitación acepta fijo, con y sin 0 o +58", () => {
    expect(contactoSchema.safeParse({ telefono_movil: "4121234567" }).success).toBe(true);
    expect(contactoSchema.safeParse({ telefono_movil: "+584121234567" }).success).toBe(true);
    expect(contactoSchema.safeParse({ telefono_movil: "02121234567" }).success).toBe(false);
    expect(contactoSchema.safeParse({ telefono_habitacion: "02121234567" }).success).toBe(true);
    expect(contactoSchema.safeParse({ telefono_habitacion: "123" }).success).toBe(false);
  });
  it("el teléfono del contacto de emergencia es obligatorio y admite otros países", () => {
    const base = { nombres: "Ana", apellidos: "Pérez", relacion_id: "3" };
    expect(contactoEmergenciaSchema.safeParse({ ...base, telefono: "+14155552671" }).success).toBe(
      true,
    );
    expect(contactoEmergenciaSchema.safeParse({ ...base, telefono: "" }).success).toBe(false);
    expect(contactoEmergenciaSchema.safeParse({ ...base, telefono: "0412" }).success).toBe(false);
  });
});

describe("contactoEmergenciaSchema / nombres", () => {
  it("no acepta números en nombres ni letras en teléfonos", () => {
    expect(
      contactoEmergenciaSchema.safeParse({
        nombres: "Ana2",
        apellidos: "Pérez",
        telefono: "0412-1234567",
      }).success,
    ).toBe(false);
    expect(
      contactoEmergenciaSchema.safeParse({
        nombres: "Ana",
        apellidos: "Pérez",
        telefono: "abc",
      }).success,
    ).toBe(false);
    expect(
      contactoEmergenciaSchema.safeParse({
        nombres: "Ana",
        apellidos: "Pérez",
        telefono: "0412-1234567",
        relacion_id: "3",
      }).success,
    ).toBe(true);
  });

  it("exige el teléfono y el parentesco o relación", () => {
    const base = { nombres: "Ana", apellidos: "Pérez", telefono: "0412-1234567", relacion_id: "3" };
    expect(contactoEmergenciaSchema.safeParse({ ...base, telefono: "" }).success).toBe(false);
    expect(contactoEmergenciaSchema.safeParse({ ...base, telefono: undefined }).success).toBe(
      false,
    );
    expect(contactoEmergenciaSchema.safeParse({ ...base, relacion_id: "" }).success).toBe(false);
    expect(contactoEmergenciaSchema.safeParse({ ...base, relacion_id: undefined }).success).toBe(
      false,
    );
    expect(contactoEmergenciaSchema.safeParse(base).success).toBe(true);
  });
});

describe("viviendaSchema / formacionSchema", () => {
  it("convierte ids de texto a número y exige los obligatorios", () => {
    const ok = viviendaSchema.parse({
      estado_id: "1",
      municipio_id: "2",
      parroquia_id: "3",
      direccion_exacta: "Calle 1, casa 2",
      condicion_vivienda_id: "4",
      codigo_postal_id: "5",
    });
    expect(ok.estado_id).toBe(1);
    expect(viviendaSchema.safeParse({ ...ok, direccion_exacta: "" }).success).toBe(false);
    // O40: la ubicación venezolana es opcional en el esquema; el formulario la
    // exige según el país y el servidor la revalida.
    expect(
      viviendaSchema.safeParse({ ...ok, estado_id: "", ciudad_region: "Santiago" }).success,
    ).toBe(true);
    expect(
      formacionSchema.parse({ nivel_academico_id: "2", carrera_id: "" }).carrera_id,
    ).toBeNull();
    expect(formacionSchema.safeParse({ nivel_academico_id: "" }).success).toBe(false);
  });
  it("la dirección exige de 10 a 500 caracteres", () => {
    const base = {
      estado_id: "1",
      municipio_id: "2",
      parroquia_id: "3",
      condicion_vivienda_id: "4",
      codigo_postal_id: "5",
    };
    expect(viviendaSchema.safeParse({ ...base, direccion_exacta: "x".repeat(9) }).success).toBe(false);
    expect(viviendaSchema.safeParse({ ...base, direccion_exacta: "x".repeat(10) }).success).toBe(true);
    expect(viviendaSchema.safeParse({ ...base, direccion_exacta: "x".repeat(500) }).success).toBe(true);
    expect(viviendaSchema.safeParse({ ...base, direccion_exacta: "x".repeat(501) }).success).toBe(false);
  });
});

describe("familiarSchema", () => {
  const base = {
    primer_nombre: "Ana",
    primer_apellido: "Pérez",
    parentesco_id: "1",
    fecha_nacimiento: "2015-05-01",
    sexo_id: "2",
  };
  it("acepta un familiar completo", () => {
    expect(familiarSchema.safeParse(base).success).toBe(true);
  });
  it("las observaciones, si se escriben, exigen de 5 a 500 caracteres", () => {
    expect(familiarSchema.safeParse({ ...base, observaciones: "" }).success).toBe(true);
    expect(familiarSchema.safeParse({ ...base, observaciones: "abcd" }).success).toBe(false);
    expect(familiarSchema.safeParse({ ...base, observaciones: "abcde" }).success).toBe(true);
    expect(familiarSchema.safeParse({ ...base, observaciones: "x".repeat(501) }).success).toBe(false);
  });
  it("rechaza fecha futura, cédula inválida y datos faltantes", () => {
    expect(familiarSchema.safeParse({ ...base, fecha_nacimiento: "2999-01-01" }).success).toBe(
      false,
    );
    expect(familiarSchema.safeParse({ ...base, cedula_familiar: "xx" }).success).toBe(false);
    expect(familiarSchema.safeParse({ ...base, cedula_familiar: "1234" }).success).toBe(false);
    expect(familiarSchema.safeParse({ ...base, cedula_familiar: "12345" }).success).toBe(true);
    expect(familiarSchema.safeParse({ ...base, primer_nombre: "" }).success).toBe(false);
    expect(familiarSchema.safeParse({ ...base, primer_nombre: "Ana2" }).success).toBe(false);
    expect(familiarSchema.safeParse({ ...base, primer_apellido: "Perez1" }).success).toBe(false);
  });
  it("TLF-1: acepta y valida el orden de nacimiento", () => {
    expect(familiarSchema.safeParse({ ...base, orden_hijo: "2" }).success).toBe(true);
    expect(familiarSchema.safeParse({ ...base, orden_hijo: 2 }).success).toBe(true);
    expect(familiarSchema.safeParse({ ...base, orden_hijo: "" }).success).toBe(true);
    expect(familiarSchema.safeParse({ ...base, orden_hijo: "0" }).success).toBe(false);
    expect(familiarSchema.safeParse({ ...base, orden_hijo: "100" }).success).toBe(false);
    expect(familiarSchema.safeParse({ ...base, orden_hijo: "abc" }).success).toBe(false);
  });
});

describe("esquemaDeEntidad", () => {
  it("resuelve el curso y exige la capacitación", () => {
    expect(complementariaSchema.safeParse({ capacitacion_id: "2" }).success).toBe(true);
    expect(complementariaSchema.safeParse({ capacitacion_id: "" }).success).toBe(false);
  });
  it("resuelve por sección y entidad; desconocidas devuelven null", () => {
    expect(esquemaDeEntidad("contacto", "employee")).not.toBeNull();
    expect(
      esquemaDeEntidad("familiar", "datos_complementarios")?.safeParse({ tiene_hijos: "true" })
        .success,
    ).toBe(true);
    expect(esquemaDeEntidad("foto", "employee")).toBeNull();
  });
  it("tiene_hijos se convierte a booleano o nulo", () => {
    const e = esquemaDeEntidad("familiar", "datos_complementarios");
    expect(e?.parse({ tiene_hijos: "false" })).toEqual({ tiene_hijos: false });
    expect(e?.parse({ tiene_hijos: "" })).toEqual({ tiene_hijos: null });
  });
});

describe("esquemas de Bienestar", () => {
  it("el plazo va de 1 a 90 días enteros", () => {
    const s = (plazoDias: unknown) =>
      habilitarVentanaSchema.safeParse({ plazoDias, secciones: ["contacto"] }).success;
    expect(s(15)).toBe(true);
    expect(s("30")).toBe(true);
    expect(s(0)).toBe(false);
    expect(s(91)).toBe(false);
    expect(s(2.5)).toBe(false);
    expect(habilitarVentanaSchema.safeParse({ plazoDias: 5, secciones: [] }).success).toBe(false);
  });
  it("la prórroga exige fecha futura y motivo", () => {
    const futuro = new Date(Date.now() + 86_400_000).toISOString();
    expect(
      prorrogaSchema.safeParse({ nuevaFechaFin: futuro, motivo: "Licencia médica" }).success,
    ).toBe(true);
    expect(
      prorrogaSchema.safeParse({ nuevaFechaFin: "2020-01-01T00:00", motivo: "x" }).success,
    ).toBe(false);
    expect(prorrogaSchema.safeParse({ nuevaFechaFin: futuro, motivo: "" }).success).toBe(false);
  });
  it("el rechazo total exige motivo", () => {
    expect(rechazoSchema.safeParse({ motivo: "" }).success).toBe(false);
    expect(rechazoSchema.safeParse({ motivo: "Soporte ilegible" }).success).toBe(true);
  });
});

describe("devolucionSchema", () => {
  it("exige motivo", () => {
    expect(devolucionSchema.safeParse({ motivo: "" }).success).toBe(false);
    expect(devolucionSchema.safeParse({ motivo: "Falta la constancia" }).success).toBe(true);
  });
});

describe("identidad (D19)", () => {
  const valido = {
    nombres: "MARIA ELENA",
    apellidos: "PEREZ",
    fecha_nacimiento: "1990-01-01",
    cedulaidentidad: "12345678",
    estadoCivil_id: "",
    carnet_patria: "123-4567890-1",
    carnet_patria_serial: "ABC123",
  };

  it("acepta el formulario completo y está registrado para el borrador", () => {
    expect(identidadSchema.safeParse(valido).success).toBe(true);
    expect(esquemaDeEntidad("identidad", "employee")).not.toBeNull();
  });

  it("exige cédula de 5 a 9 dígitos y fecha no futura", () => {
    expect(identidadSchema.safeParse({ ...valido, cedulaidentidad: "1234" }).success).toBe(false);
    expect(identidadSchema.safeParse({ ...valido, cedulaidentidad: "1234567890" }).success).toBe(
      false,
    );
    expect(identidadSchema.safeParse({ ...valido, fecha_nacimiento: "2999-01-01" }).success).toBe(
      false,
    );
  });

  it("el código del Carnet de la Patria debe tener 10 dígitos (acepta el formato legado)", () => {
    expect(identidadSchema.safeParse({ ...valido, carnet_patria: "123" }).success).toBe(false);
    expect(identidadSchema.safeParse({ ...valido, carnet_patria: "000-0000000-0" }).success).toBe(
      true,
    );
  });
});

describe("salud y tallas (D21)", () => {
  it("normaliza las listas (sin repetidos y ordenadas) y no exige documento", () => {
    const r = perfilSaludSchema.safeParse({
      grupo_sanguineo_id: "",
      alergias: [3, 1, 3],
      patologias_cronicas: [],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.alergias).toEqual([1, 3]);
      expect(r.data.patologias_cronicas).toEqual([]);
      expect(r.data.discapacidades).toEqual([]);
    }
    expect(esquemaDeEntidad("salud", "perfil_salud")).not.toBeNull();
    expect(esquemaDeEntidad("salud", "perfil_fisico")).not.toBeNull();
  });

  it("las tallas son opcionales en el borrador", () => {
    expect(perfilFisicoSchema.safeParse({}).success).toBe(true);
  });
});

describe("antecedentes de servicio (O37)", () => {
  it("valida el esquema de antecedentes y su mapeo en ESQUEMAS_ENTIDAD", () => {
    expect(
      antecedenteSchema.safeParse({
        organismo_id: 1,
        fecha_ingreso: "2020-01-15",
        fecha_egreso: "2022-06-30",
      }).success,
    ).toBe(true);
    expect(
      antecedenteSchema.safeParse({
        organismo_id: 1,
        fecha_ingreso: "2020-01-15",
        fecha_egreso: "",
      }).success,
    ).toBe(true);
    expect(
      antecedenteSchema.safeParse({
        organismo_id: "",
        fecha_ingreso: "2020-01-15",
      }).success,
    ).toBe(false);
    expect(esquemaDeEntidad("antecedentes", "antecedente_servicio")).not.toBeNull();
  });
});
