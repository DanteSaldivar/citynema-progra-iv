import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environment/environment';

/**
 * Crea un unico cliente de Supabase para toda la aplicacion.
 * Todos los servicios que necesiten hablar con la base usan este.
 */

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  );
}