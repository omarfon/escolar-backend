export interface RequestUser {
  id: string;
  username: string;
  nombre?: string;
  roles: string[];
  permisos: string[];
  esAdmin: boolean;
  ambitos?: string[];
  rolPrincipal?: string;
  institutionId?: number | null;
  ugelCodigo?: string | null;
  dreCodigo?: string | null;
}


