import { object, string } from "zod";
import { z } from "zod";

export const signInSchema = object({
  email: string({ required_error: "El correo es requerido" })
    .min(1, "El correo es requerido")
    .email("Correo electrónico inválido"),
  password: string({ required_error: "La contraseña es requerida" })
    .min(1, "La contraseña es requerida")
    .min(5, "La contraseña debe tener más de 8 caracteres")
    .max(32, "La contraseña debe tener menos de 32 caracteres"),
});

export const changePasswordSchema = z
  .object({
    new_password: z
      .string({ required_error: "La nueva contraseña es requerida" })
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .max(32, "La contraseña debe tener máximo 32 caracteres"),
    confirm_password: z
      .string({ required_error: "Confirme su nueva contraseña" })
      .min(1, "Confirme su nueva contraseña"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Las contraseñas no coinciden",
    path: ["confirm_password"],
  });

export const registerInSchema = z
  .object({
    email: z
      .string({ required_error: "Email es requerido" })
      .min(1, "Email es requerido")
      .email("Correo electrónico inválido"),
    cedula: z
      .string({ required_error: "La cédula es requerida" })
      .min(6, "La cédula debe tener al menos 6 dígitos")
      .max(10, "La cédula debe tener máximo 10 dígitos")
      .regex(/^\d+$/, "La cédula solo debe contener números"),
    password: z
      .string({ required_error: "La contraseña es requerida" })
      .min(1, "La contraseña es requerida")
      .min(8, "La contraseña debe tener más de 8 caracteres")
      .max(20, "La contraseña debe tener menos de 20 caracteres"),
    password2: z
      .string({
        required_error: "La confirmación de la contraseña es requerida",
      })
      .min(1, "La confirmación de la contraseña es requerida"),
    departament: z.enum(["1", "2", "3", "4", "5"], {
      required_error: "Debes seleccionar un departamento",
      invalid_type_error: "Departamento inválido",
    }),
    status: z.enum(["ANALISTA", "ADMINISTRADOR"], {
      required_error: "Debes seleccionar un rol",
      invalid_type_error: "Rol inválido",
    }),
    phone: z.string().optional(),
  })
  .refine((data) => data.password === data.password2, {
    message: "Las contraseñas no coinciden",
    path: ["password2"],
  });
