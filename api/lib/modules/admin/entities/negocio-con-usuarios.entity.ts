/// Nunca incluye passwordHash — es lo que ve el panel de super-admin.
export class UsuarioResumenEntity {
  id!: string;

  nombre!: string;

  email!: string;

  whatsappNumber!: string | null;

  esSuperAdmin!: boolean;

  activo!: boolean;
}

export class NegocioConUsuariosEntity {
  id!: string;

  nombre!: string;

  activo!: boolean;

  createdAt!: Date;

  usuarios!: UsuarioResumenEntity[];
}
