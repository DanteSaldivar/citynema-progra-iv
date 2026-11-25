import { Component, computed, effect, input, output, signal } from '@angular/core';

const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Cantidad de días de un mes dado (1-12), respetando años bisiestos. */
function diasEnMes(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate();
}

@Component({
  imports: [],
  selector: 'app-fecha-hora-select',
  styleUrl: './fecha-hora-select.component.css',
  templateUrl: './fecha-hora-select.component.html',
})
export class FechaHoraSelectComponent {

  /** Fecha inicial opcional. Si no se pasa, arranca en "ahora". */
  valorInicial = input<Date | undefined>(undefined);

  /** Rango de años a ofrecer hacia adelante (programación de funciones a futuro). */
  aniosHaciaAdelante = input(2);

  /** Emite la fecha completa cada vez que el usuario cambia cualquier select. */
  valorCambio = output<Date>();

  // --- Estado interno, con signals ---
  private readonly ahora = new Date();
  mostrarHora = input(true);

  fechaMinima = input<Date | undefined>(undefined);
  fechaMaxima = input<Date | undefined>(undefined);

  dia = signal(this.ahora.getDate());
  mes = signal(this.ahora.getMonth() + 1); // 1-12, más natural para mostrar que 0-11
  anio = signal(this.ahora.getFullYear());
  hora = signal(this.ahora.getHours());

  meses = NOMBRES_MES.map((nombre, i) => ({ valor: i + 1, nombre }));
  horas = Array.from({ length: 24 }, (_, i) => i);
  minutos = [0, 15, 30, 45]; // cambiá a [0..59] si necesitás precisión al minuto exacto
  minuto = signal(this.redondearMinuto(this.ahora.getMinutes()));

  // Los días del mes dependen del mes/año elegidos (ej. febrero tiene 28 o 29)
  diasDelMes = computed(() => {
    const anio = this.anio();
    const mes = this.mes();

    const fechaMin = this.fechaMinima();
    const fechaMax = this.fechaMaxima();

    let diaMin = 1;
    let diaMax = diasEnMes(anio, mes);

    // Límite inferior
    if (
      fechaMin &&
      anio === fechaMin.getFullYear() &&
      mes === fechaMin.getMonth() + 1
    ) {
      diaMin = fechaMin.getDate();
    }

    // Límite superior
    if (
      fechaMax &&
      anio === fechaMax.getFullYear() &&
      mes === fechaMax.getMonth() + 1
    ) {
      diaMax = fechaMax.getDate();
    }

    return Array.from(
      { length: diaMax - diaMin + 1 },
      (_, i) => diaMin + i
    );
  });

  anios = computed(() => {
    const base = this.ahora.getFullYear();

    const minimo = this.fechaMinima()?.getFullYear() ?? base;
    const maximo =
      this.fechaMaxima()?.getFullYear() ??
      base + this.aniosHaciaAdelante();

    return Array.from(
      { length: maximo - minimo + 1 },
      (_, i) => minimo + i
    );
  });
  mesesDisponibles = computed(() => {
    const anio = this.anio();

    return this.meses.filter(m => {
      if (this.fechaMinima() &&
        anio === this.fechaMinima()!.getFullYear() &&
        m.valor < this.fechaMinima()!.getMonth() + 1) {
        return false;
      }

      if (this.fechaMaxima() &&
        anio === this.fechaMaxima()!.getFullYear() &&
        m.valor > this.fechaMaxima()!.getMonth() + 1) {
        return false;
      }

      return true;
    });
  });



  /** La fecha final, recalculada automáticamente cuando cambia cualquier parte. */
  fecha = computed(() => new Date(this.anio(), this.mes() - 1, this.dia(), this.hora(), this.minuto()));

  constructor() {
    // Si el padre pasa un valor inicial, sembramos los signals con él.
    effect(() => {
      const inicial = this.valorInicial();
      if (inicial) {
        this.dia.set(inicial.getDate());
        this.mes.set(inicial.getMonth() + 1);
        this.anio.set(inicial.getFullYear());
        this.hora.set(inicial.getHours());
        this.minuto.set(this.redondearMinuto(inicial.getMinutes()));
      }
    });

    // Cada vez que la fecha calculada cambia, se la avisamos al padre.
    effect(() => this.valorCambio.emit(this.fecha()));
  }

  onDiaChange(e: Event) {
    this.dia.set(Number((e.target as HTMLSelectElement).value));
  }

  onMesChange(e: Event) {
    const nuevoMes = Number(
      (e.target as HTMLSelectElement).value
    );

    this.mes.set(nuevoMes);

    const diasPermitidos = this.diasDelMes();

    if (!diasPermitidos.includes(this.dia())) {
      this.dia.set(diasPermitidos[0]);
    }
  }

  onAnioChange(e: Event) {
  const nuevoAnio = Number(
    (e.target as HTMLSelectElement).value
  );

  this.anio.set(nuevoAnio);

  const diasPermitidos = this.diasDelMes();

  if (!diasPermitidos.includes(this.dia())) {
    this.dia.set(diasPermitidos[0]);
  }
}

  onHoraChange(e: Event) {
    this.hora.set(Number((e.target as HTMLSelectElement).value));
  }

  onMinutoChange(e: Event) {
    this.minuto.set(Number((e.target as HTMLSelectElement).value));
  }

  private redondearMinuto(m: number): number {
    // Lleva el minuto actual al valor de "minutos" más cercano hacia abajo.
    return this.minutos.reduce((mejor, actual) => (actual <= m ? actual : mejor), 0);
  }

}
