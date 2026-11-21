import { DefaultSession } from "next-auth";
import "next-auth/jwt";
import type {
  SesionPostulanteJwt,
  SesionPostulantePublica,
} from "@/modules/postulacion/domain/sesion";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      role: {
        id: number;
        nombre_rol: string;
        nombre_visible?: string;
      };
      cedula: string;
      phone: string;
      email: string;
      directionGeneral: {
        id: string;
        nombre: string;
      };
      direccionLine: {
        id: string;
        nombre: string;
      } | null;
      coordination: { id: string; nombre: string } | null;
      dependency: {
        id: string;
        nombre: string;
      };
      debeCambiarPassword: boolean;
      permisos: string[];
      /** ACTIVO | PASIVO | SIN_ASIGNACION: dato derivado en servidor, no un rol. */
      condicionTrabajador: string;
      /** Solo rol POSTULANTE; sin el token de Django. */
      sesionPostulante?: SesionPostulantePublica;
    } & DefaultSession["user"];
  }
  interface User {
    id: string;
    name: string;
    role: {
      id: number;
      nombre_rol: string;
      nombre_visible?: string;
    };
    cedula: string;
    phone: string;
    email: string;
    directionGeneral: {
      id: string;
      nombre: string;
    };
    direccionLine: {
      id: string;
      nombre: string;
    } | null;
    coordination: { id: string; nombre: string } | null;
    dependency: {
      id: string;
      nombre: string;
    };
    debeCambiarPassword?: boolean;
    djAccess: string;
    djRefresh: string;
    permisos?: string[];
    condicionTrabajador?: string;
    postulante?: SesionPostulanteJwt;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    name: string;
    role: {
      id: number;
      nombre_rol: string;
      nombre_visible?: string;
    };
    cedula: string;
    phone: string;
    email: string;
    directionGeneral: {
      id: string;
      nombre: string;
    };
    direccionLine: {
      id: string;
      nombre: string;
    } | null;
    coordination: { id: string; nombre: string } | null;
    dependency: {
      id: string;
      nombre: string;
    };
    debeCambiarPassword?: boolean;
    permisos?: string[];
    condicionTrabajador?: string;
    postulante?: SesionPostulanteJwt;
  }
}
