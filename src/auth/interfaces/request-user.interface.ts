export interface RequestUser {

  id: string;

  username: string;

  nombre?: string;

  roles: string[];

  permisos: string[];

  esAdmin: boolean;

}


