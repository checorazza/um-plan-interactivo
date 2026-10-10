export interface Usuario {
  id_usuario: number;
  email: string;
  nombre: string | null;
  foto_url: string | null;
  es_admin: boolean;
}
