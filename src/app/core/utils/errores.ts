interface ErrorSupabaseLike {
  code?: string;
  message?: string;
  details?: string;
  status?: number;
}

export function traducirError(error: unknown): string {
  if (!error) {
    return 'Ocurrió un error inesperado. Intentá nuevamente.';
  }

  if (typeof error === 'string') {
    return mapearMensaje(error);
  }

  const err = error as ErrorSupabaseLike;
  const code = err.code ?? '';
  const msg = err.message ?? '';

  // Errores PostgreSQL estándar
  if (code === '23505') {
    if (msg.includes('uq_entradas_funcion_butaca_activa') || msg.includes('reservas_butaca')) {
      return 'Una o más butacas seleccionadas acaban de ser ocupadas por otro usuario.';
    }
    if (msg.includes('profiles_email_key')) {
      return 'Ya existe una cuenta registrada con ese correo electrónico.';
    }
    if (msg.includes('resenias_pelicula_id_user_id_key')) {
      return 'Ya publicaste una reseña para esta película.';
    }
    if (msg.includes('cupones_codigo_key')) {
      return 'Ya existe un cupón con ese código.';
    }
    if (msg.includes('salas_nombre_key') || msg.includes('salas_numero_key')) {
      return 'Ya existe una sala con ese nombre o número.';
    }
    if (msg.includes('generos_nombre_key') || msg.includes('generos_slug_key')) {
      return 'Ya existe un género con ese nombre.';
    }
    return 'Ya existe un registro con esos mismos datos.';
  }

  if (code === '23503') {
    return 'No se puede completar la operación porque hay datos relacionados inexistentes o en uso.';
  }

  if (code === '23514') {
    return 'Alguno de los valores ingresados no cumple con las reglas permitidas.';
  }

  if (code === '42501') {
    return 'No tenés permisos suficientes para realizar esta acción.';
  }

  if (code === 'PGRST116') {
    return 'No se encontró el registro solicitado.';
  }

  // Excepciones de negocio lanzadas por nuestras funciones RPC (P0001)
  if (code === 'P0001' && msg) {
    return msg;
  }

  return mapearMensaje(msg);
}

function mapearMensaje(mensaje: string): string {
  const lower = mensaje.toLowerCase();

  if (lower.includes('invalid login credentials')) {
    return 'El correo electrónico o la contraseña son incorrectos.';
  }
  if (lower.includes('user already registered')) {
    return 'Ya existe una cuenta registrada con este correo electrónico.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Tu cuenta todavía no fue confirmada. Revisá tu casilla de correo.';
  }
  if (
    lower.includes('password should be at least') ||
    lower.includes('weak password') ||
    lower.includes('password is too short')
  ) {
    return 'La contraseña es demasiado débil. Usá al menos 6 caracteres combinando letras y números.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Demasiados intentos seguidos. Esperá unos segundos antes de volver a intentar.';
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('load failed')
  ) {
    return 'Sin conexión con el servidor. Verificá tu conexión a internet e intentá de nuevo.';
  }
  if (lower.includes('row-level security')) {
    return 'No tenés permisos para efectuar esta operación.';
  }

  return mensaje || 'Ocurrió un error inesperado al procesar la solicitud.';
}