import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../../core/supabase.service';

export type Clasificacion = 'atp' | '13' | '18';

export type EstadoPelicula =
  | 'en_cartelera'
  | 'proximamente'
  | 'finalizado';

export interface CrearPeliculaDTO {
  titulo: string;
  sinopsis: string;
  duracion_min: number;
  clasificacion: Clasificacion;
  fecha_estreno: string;
  estado: EstadoPelicula;
}

@Injectable({
  providedIn: 'root'
})
export class PeliculasService {

    private readonly supabaseService = inject(SupabaseService);
  private readonly tabla = 'peliculas';
  private readonly bucket = 'posters';

  /**
   * Registra una película y sube su póster a Supabase Storage.
   */
  async crear(dto: CrearPeliculaDTO, poster: File): Promise<void> {
    // 1. Generar una ruta única para el póster.
    const extensionPorTipo: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp'
    };

    const extension = extensionPorTipo[poster.type];

    if (!extension) {
      throw new Error('El formato del póster no es válido.');
    }

    if (poster.size > 5 * 1024 * 1024) {
      throw new Error('El póster no puede superar los 5 MB.');
    }

    const rutaPoster = `${crypto.randomUUID()}.${extension}`;

    // 2. Subir la imagen.
    const { error: errorStorage } =
      await this.supabaseService.client.storage
        .from(this.bucket)
        .upload(rutaPoster, poster, {
          contentType: poster.type,
          upsert: false
        });

    if (errorStorage) {
      throw new Error(`Error al subir el póster: ${errorStorage.message}`);
    }

    try {
      // 3. Obtener la URL pública.
      const { data: imagen } =
        this.supabaseService.client.storage
          .from(this.bucket)
          .getPublicUrl(rutaPoster);

      // 4. Guardar la película.
      const { error: errorInsert } =
        await this.supabaseService.client
          .from(this.tabla)
          .insert({
            ...dto,
            poster_url: imagen.publicUrl
          });

      if (errorInsert) {
        throw new Error(
          `Error al registrar la película: ${errorInsert.message}`
        );
      }
    } catch (error: unknown) {
      // 5. Si falla el registro, intentar eliminar la imagen subida.
      const { error: errorEliminar } =
        await this.supabaseService.client.storage
          .from(this.bucket)
          .remove([rutaPoster]);

      if (errorEliminar) {
        console.error(
          'No se pudo eliminar el póster sobrante:',
          errorEliminar
        );
      }

      throw error;
    }
  }

}
