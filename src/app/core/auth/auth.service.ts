import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../supabase.service';
import { Perfil, RolUsuario } from '../models/database.types';

export interface RegistroDTO {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string; // YYYY-MM-DD
  tipo_sangre: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  color_ojos: string;
  dias_vacaciones: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly supabaseService = inject(SupabaseService);

  // Signals de estado de sesión
  private perfilSignal = signal<Perfil | null>(null);
  private cargandoSignal = signal<boolean>(true);

  // Computeds públicos
  readonly perfil = computed(() => this.perfilSignal());
  readonly estaAutenticado = computed(() => !!this.perfilSignal());
  readonly rol = computed<RolUsuario | null>(() => this.perfilSignal()?.rol ?? null);
  readonly esAdmin = computed(() => this.perfilSignal()?.rol === 'admin');
  readonly esEmpleado = computed(() => this.perfilSignal()?.rol === 'empleado');
  readonly esCliente = computed(() => this.perfilSignal()?.rol === 'cliente');
  readonly cargando = computed(() => this.cargandoSignal());

  private inicializacion: Promise<void>;

  constructor(private router: Router) {
     this.inicializacion = this.inicializarSesion();
  }

  async esperarInicializacion(): Promise<void> {
  return this.inicializacion;
}

  private async inicializarSesion(): Promise<void> {
    try {
      const { data: { session } } = await this.supabaseService.client.auth.getSession();
      
      if (session?.user) {
        await this.cargarPerfil(session.user.id);
      }
    } finally {
      this.cargandoSignal.set(false);
    }

    // Escucha cambios en el estado de autenticación (login, logout, refresh)
    this.supabaseService.client.auth.onAuthStateChange(async (event, session) => {
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
   * RF-AUT-01: Registro con los 7 campos requeridos por el cliente (01/01).
   * Nota de defensa oral: No usamos triggers en SQL. El servicio crea la cuenta
   * en Supabase Auth y luego inserta el registro en public.profiles en secuencia.
   */
  async registrar(dto: RegistroDTO): Promise<void> {
    // 1. Crear usuario en Auth
    const { data: authData, error: authError } = await this.supabaseService.client.auth.signUp({
      email: dto.email,
      password: dto.password
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message || 'Error al crear credenciales de acceso.');
    }

    // 2. Insertar perfil en public.profiles (RN: rol por defecto es 'cliente')
    const { error: profileError } = await this.supabaseService.client
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: dto.email,
        nombre: dto.nombre,
        apellido: dto.apellido,
        fecha_nacimiento: dto.fecha_nacimiento,
        tipo_sangre: dto.tipo_sangre,
        color_ojos: dto.color_ojos,
        dias_vacaciones: dto.dias_vacaciones,
        rol: 'cliente'
      });

    if (profileError) {
      throw new Error(`Error al guardar perfil de usuario: ${profileError.message}`);
    }

    await this.cargarPerfil(authData.user.id);
  }

  /**
   * RF-AUT-02: Inicio de sesión con email y contraseña.
   */
  async iniciarSesion(email: string, pass: string): Promise<Perfil> {
    const { data, error } = await this.supabaseService.client.auth.signInWithPassword({
      email,
      password: pass
    });

    if (error || !data.user) {
      throw new Error(error?.message || 'Credenciales inválidas.');
    }

    const perfil = await this.cargarPerfil(data.user.id);
    if (!perfil) throw new Error('No se encontró el perfil del usuario.');
    return perfil;
  }

  /**
   * Cierre de sesión.
   */
  async cerrarSesion(): Promise<void> {
    await this.supabaseService.client.auth.signOut();
    this.perfilSignal.set(null);
  }

}