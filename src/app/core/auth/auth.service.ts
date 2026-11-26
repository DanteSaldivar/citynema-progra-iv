import { Injectable, signal, computed, inject } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { Perfil, RolUsuario, TipoSangre } from '../models/database.types';
import { ROLES_USUARIO } from '../models/constantes';
import { ClavePermisoAdmin, ItemMenuAdmin, PERMISOS_ADMIN } from './permisos';
import { Result, fail, ok } from '../utils/result';
import { traducirError } from '../utils/errores';

export interface RegistroDTO {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string; // YYYY-MM-DD
  tipo_sangre: TipoSangre;
  color_ojos: string;
  dias_vacaciones: number;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly supabaseService = inject(SupabaseService);

  private perfilSignal = signal<Perfil | null>(null);
  private cargandoSignal = signal<boolean>(true);

  readonly perfil = computed(() => this.perfilSignal());
  readonly estaAutenticado = computed(() => !!this.perfilSignal());
  readonly rol = computed<RolUsuario | null>(() => this.perfilSignal()?.rol ?? null);
  readonly esAdmin = computed(() => this.perfilSignal()?.rol === ROLES_USUARIO.ADMIN);
  readonly esEmpleado = computed(() => this.perfilSignal()?.rol === ROLES_USUARIO.EMPLEADO);
  readonly esCliente = computed(() => this.perfilSignal()?.rol === ROLES_USUARIO.CLIENTE);
  readonly cargando = computed(() => this.cargandoSignal());

  private inicializacion: Promise<void>;

  constructor() {
    this.inicializacion = this.inicializarSesion();
  }

  async esperarInicializacion(): Promise<void> {
    return this.inicializacion;
  }

  private async inicializarSesion(): Promise<void> {
    try {
      const {
        data: { session },
      } = await this.supabaseService.client.auth.getSession();

      if (session?.user) {
        await this.cargarPerfil(session.user.id);
      }
    } finally {
      this.cargandoSignal.set(false);
    }

    // Escucha cambios en el estado de autenticación (login, logout, refresh)
    this.supabaseService.client.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await this.cargarPerfil(session.user.id);
      } else {
        this.perfilSignal.set(null);
      }
    });
  }

  async cargarPerfil(userId: string): Promise<Perfil | null> {
    const { data, error } = await this.supabaseService.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.error('Error cargando perfil:', error);
      this.perfilSignal.set(null);
      return null;
    }

    const perfil = data as Perfil;
    this.perfilSignal.set(perfil);
    return perfil;
  }

  /**
   * Gancho para roles configurables (se ampliará en el Anexo).
   * Por ahora: rol 'admin' posee todos los permisos y otros roles ninguno.
   */
  tienePermiso(_permiso: ClavePermisoAdmin): boolean {
    return this.rol() === ROLES_USUARIO.ADMIN;
  }

  obtenerMenuAdmin(): ItemMenuAdmin[] {
    return (Object.keys(PERMISOS_ADMIN) as ClavePermisoAdmin[])
      .filter((clave) => this.tienePermiso(clave))
      .map((clave) => ({
        clave,
        etiqueta: PERMISOS_ADMIN[clave].etiqueta,
        ruta: PERMISOS_ADMIN[clave].ruta,
      }));
  }

  /**
   * RF-AUT-01: Registro con los 7 campos requeridos por el cliente.
   * Crea la cuenta en Supabase Auth e inserta en public.profiles en secuencia.
   */
  async registrar(dto: RegistroDTO): Promise<Result<Perfil>> {
    // 1. Crear usuario en Auth
    const { data: authData, error: authError } = await this.supabaseService.client.auth.signUp({
      email: dto.email.trim(),
      password: dto.password,
    });

    if (authError || !authData.user) {
      return fail(traducirError(authError ?? 'Error al crear credenciales de acceso.'));
    }

    // Si Supabase tiene activada la confirmación por correo, signUp devuelve user sin session
    if (!authData.session) {
      return fail(
        'La cuenta se creó pero requiere confirmación de email en Supabase. Revisá tu casilla o desactivá "Confirm email" en Auth -> Providers -> Email.'
      );
    }

    // 2. Insertar perfil en public.profiles (rol por defecto: 'cliente')
    const { error: profileError } = await this.supabaseService.client.from('profiles').insert({
      id: authData.user.id,
      email: dto.email.trim(),
      nombre: dto.nombre.trim(),
      apellido: dto.apellido.trim(),
      fecha_nacimiento: dto.fecha_nacimiento,
      tipo_sangre: dto.tipo_sangre,
      color_ojos: dto.color_ojos.trim(),
      dias_vacaciones: Number(dto.dias_vacaciones),
      rol: ROLES_USUARIO.CLIENTE,
    });

    if (profileError) {
      return fail(traducirError(profileError));
    }

    const perfil = await this.cargarPerfil(authData.user.id);
    if (!perfil) {
      return fail('La cuenta se creó, pero no se pudo cargar el perfil del usuario.');
    }

    return ok(perfil);
  }

  /**
   * RF-AUT-02: Inicio de sesión con email y contraseña.
   */
  async iniciarSesion(email: string, pass: string): Promise<Perfil> {
    const { data, error } = await this.supabaseService.client.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error || !data.user) {
      throw new Error(traducirError(error ?? 'Credenciales inválidas.'));
    }

    const perfil = await this.cargarPerfil(data.user.id);
    if (!perfil) throw new Error('No se encontró el perfil del usuario.');
    return perfil;
  }

  async cerrarSesion(): Promise<void> {
    await this.supabaseService.client.auth.signOut();
    this.perfilSignal.set(null);
  }
}