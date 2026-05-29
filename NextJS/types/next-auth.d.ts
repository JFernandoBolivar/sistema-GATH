import { DefaultSession } from "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      role: {
        id: number;
        nombre_rol: string;
      };
      department: {
        id: number;
        nombre_departamento: string;
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
      debeCambiarPassword: boolean;
    } & DefaultSession["user"];
  }
  interface User {
    id: string;
    name: string;
    role: {
      id: number;
      nombre_rol: string;
    };
    department: {
      id: number;
      nombre_departamento: string;
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
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    name: string;
    role: {
      id: number;
      nombre_rol: string;
    };
    department: {
      id: number;
      nombre_departamento: string;
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
  }
}
