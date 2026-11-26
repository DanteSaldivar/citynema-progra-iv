import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { AuthService } from '../auth/auth.service';
import { Json } from '../models/database.types';
import { fail, ok, Result } from '../utils/result';
import { traducirError } from '../utils/errores';


export interface RegistroAuditoriaInput {
  accion: string;
  entidad: string;
  entidad_id?: string | null;
  datos_antes?: Json | null;
  datos_despues?: Json | null;
}

@Injectable({
  providedIn: 'root',
})
export class AuditService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);


  async registrar(entrada: RegistroAuditoriaInput): Promise<Result<void>> {
    try {
      const perfil = this.auth.perfil();

      const { error } = await this.supabase.client.from('audit_log').insert({
        actor_id: perfil?.id ?? null,
        actor_rol: perfil?.rol ?? null,
        accion: entrada.accion,
        entidad: entrada.entidad,
        entidad_id: entrada.entidad_id ?? null,
        datos_antes: entrada.datos_antes ?? null,
        datos_despues: entrada.datos_despues ?? null,
      });

      if (error) {
        console.error('[AuditService] Error al registrar auditoría:', error);
        return fail(traducirError(error));
      }

      return ok(undefined);
    } catch (err) {
      console.error('[AuditService] Excepción inesperada al registrar auditoría:', err);
      return fail(traducirError(err));
    }
  }
}