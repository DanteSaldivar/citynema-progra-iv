import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../../core/supabase.service';
import { AuditService } from '../../../core/services/audit.service';
import { Butaca, ColumnaButaca, Sala, TipoButaca } from '../../../core/models/database.types';
import { ESTADOS_FUNCION, TIPOS_BUTACA, } from '../../../core/models/constantes';
import { Result, fail, ok } from '../../../core/utils/result';
import { traducirError } from '../../../core/utils/errores';

export interface SalaAdminItem extends Sala {
  cantidad_butacas: number;
}

type NuevaButacaInsert = Omit<Butaca, 'id'>;

const FILAS_SALA = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
] as const;

const TAMANIO_LOTE_BUTACAS = 200;

@Injectable({
  providedIn: 'root',
})
export class SalasService {
  private readonly supabase = inject(SupabaseService);
  private readonly audit = inject(AuditService);

  /**
   * Lista todas las salas ordenadas por número (desempate por id)
   * junto con la cantidad de butacas activas cargadas en cada una.
   */
  async listarConConteo(): Promise<Result<SalaAdminItem[]>> {
    const { data, error } = await this.supabase.client
      .from('salas')
      .select('*, butacas(count)')
      .order('numero', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      return fail(traducirError(error));
    }

    const items: SalaAdminItem[] = (data ?? []).map((row: Record<string, unknown>) => {
      const conteoArr = row['butacas'] as Array<{ count: number }> | null;
      const cantidad_butacas = conteoArr?.[0]?.count ?? 0;
      const { butacas: _omit, ...salaBase } = row;

      return {
        ...(salaBase as unknown as Sala),
        cantidad_butacas,
      };
    });

    return ok(items);
  }

  /**
   * RN-02 / RN-03: Genera en memoria la grilla estándar de 532 butacas (20 filas A-T):
   * - Filas J y K: 2 izquierda / 10 centro / 2 derecha (14 por fila), tipo 'accesible' (28 total).
   * - Filas R, S y T: 4 izquierda / 20 centro / 4 derecha (28 por fila), tipo 'vip' (84 total).
   * - Resto de filas (A-I, L-Q): 4 izquierda / 20 centro / 4 derecha (28 por fila), tipo 'estandar' (420 total).
   */
  generarButacasParaSala(salaId: string): NuevaButacaInsert[] {
    const resultado: NuevaButacaInsert[] = [];

    for (const fila of FILAS_SALA) {
      const esAccesible = fila === 'J' || fila === 'K';
      const esVip = fila === 'R' || fila === 'S' || fila === 'T';

      const tipo: TipoButaca = esAccesible
        ? TIPOS_BUTACA.ACCESIBLE
        : esVip
          ? TIPOS_BUTACA.VIP
          : TIPOS_BUTACA.ESTANDAR;

      const cantIzq = esAccesible ? 2 : 4;
      const cantCen = esAccesible ? 10 : 20;
      const cantDer = esAccesible ? 2 : 4;

      const bloques: Array<{ columna: ColumnaButaca; cantidad: number }> = [
        { columna: 'izquierda', cantidad: cantIzq },
        { columna: 'centro', cantidad: cantCen },
        { columna: 'derecha', cantidad: cantDer },
      ];

      let numeroCorrelativo = 1;
      for (const bloque of bloques) {
        for (let i = 0; i < bloque.cantidad; i++) {
          resultado.push({
            sala_id: salaId,
            fila,
            columna: bloque.columna,
            numero: numeroCorrelativo++,
            tipo,
            activa: true,
          });
        }
      }
    }

    return resultado;
  }

  /**
   * RF-ADM-03 / RN-02 / RN-03 / RN-19:
   * Crea la sala e inserta sus 532 butacas en lotes de ~200 registros.
   * Si algún lote falla a mitad de camino, elimina las butacas ya insertadas y la sala
   * para no dejar salas incompletas en la base.
   */
  async crearConButacas(nombre: string, numero: number): Promise<Result<SalaAdminItem>> {
    const nombreLimpio = nombre.trim();
    const numeroEntero = Number(numero);

    if (!nombreLimpio) {
      return fail('Ingresá un nombre válido para la sala.');
    }
    if (!Number.isInteger(numeroEntero) || numeroEntero <= 0) {
      return fail('El número de sala debe ser un entero mayor a cero.');
    }

    // 1. Insertar registro maestro de la sala
    const { data: salaCreada, error: errSala } = await this.supabase.client
      .from('salas')
      .insert({
        nombre: nombreLimpio,
        numero: numeroEntero,
        activa: true,
      })
      .select('*')
      .single();

    if (errSala || !salaCreada) {
      return fail(traducirError(errSala));
    }

    const sala = salaCreada as Sala;
    const todasLasButacas = this.generarButacasParaSala(sala.id);

    // 2. Insertar las 532 butacas en lotes secuenciales (~200 por lote)
    try {
      for (let i = 0; i < todasLasButacas.length; i += TAMANIO_LOTE_BUTACAS) {
        const lote = todasLasButacas.slice(i, i + TAMANIO_LOTE_BUTACAS);
        const { error: errLote } = await this.supabase.client.from('butacas').insert(lote);

        if (errLote) {
          throw errLote;
        }
      }
    } catch (errLote) {
      // Rollback manual: limpiar butacas parciales y borrar la sala creada
      await this.supabase.client.from('butacas').delete().eq('sala_id', sala.id);
      await this.supabase.client.from('salas').delete().eq('id', sala.id);

      return fail(
        `No se pudieron generar las 532 butacas de la sala y se revirtió la creación: ${traducirError(errLote)}`
      );
    }

    // 3. Registrar en audit_log
    await this.audit.registrar({
      accion: 'crear_sala',
      entidad: 'salas',
      entidad_id: sala.id,
      datos_despues: {
        nombre: sala.nombre,
        numero: sala.numero,
        butacas_generadas: todasLasButacas.length,
      },
    });

    return ok({
      ...sala,
      cantidad_butacas: todasLasButacas.length,
    });
  }

  /** Obtiene todas las butacas de una sala ordenadas por fila y número para la vista previa. */
  async obtenerButacasDeSala(salaId: string): Promise<Result<Butaca[]>> {
    const { data, error } = await this.supabase.client
      .from('butacas')
      .select('*')
      .eq('sala_id', salaId)
      .order('fila', { ascending: true })
      .order('numero', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      return fail(traducirError(error));
    }

    return ok((data ?? []) as Butaca[]);
  }

  /** Cuenta cuántas funciones futuras programadas tiene asignadas una sala. */
  async contarFuncionesFuturas(salaId: string): Promise<Result<number>> {
    const ahoraISO = new Date().toISOString();

    const { count, error } = await this.supabase.client
      .from('funciones')
      .select('*', { count: 'exact', head: true })
      .eq('sala_id', salaId)
      .eq('estado', ESTADOS_FUNCION.PROGRAMADA)
      .gte('inicio', ahoraISO);

    if (error) {
      return fail(traducirError(error));
    }

    return ok(count ?? 0);
  }

  /**
   * Baja lógica de sala (activa = true/false) con registro en audit_log.
   */
  async cambiarEstadoActiva(salaId: string, activa: boolean): Promise<Result<Sala>> {
    const { data, error } = await this.supabase.client
      .from('salas')
      .update({ activa })
      .eq('id', salaId)
      .select('*')
      .single();

    if (error || !data) {
      return fail(traducirError(error));
    }

    const sala = data as Sala;

    await this.audit.registrar({
      accion: activa ? 'activar_sala' : 'desactivar_sala',
      entidad: 'salas',
      entidad_id: sala.id,
      datos_antes: { activa: !activa },
      datos_despues: { activa, nombre: sala.nombre, numero: sala.numero },
    });

    return ok(sala);
  }
}