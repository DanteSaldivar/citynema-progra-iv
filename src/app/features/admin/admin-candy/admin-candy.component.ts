import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CategoriaProducto, Producto, } from '../../../../app/core/models/database.types';
import { ToastService } from '../../../../app/core/services/toast.service';
import { ModalComponent } from '../../../../app/shared/utilidades/modal/modal.component';
import { AdminCandyService, ComboAdminItem, ProductoAdminItem, } from '../admin-candy.service';

type PestanaCandy = 'productos' | 'categorias' | 'combos';

@Component({
  imports: [CurrencyPipe, ReactiveFormsModule, ModalComponent],
  selector: 'app-admin-candy',
  styleUrl: './admin-candy.component.css',
  templateUrl: './admin-candy.component.html',
})
export class AdminCandyComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly candyService = inject(AdminCandyService);
  private readonly toast = inject(ToastService);

  readonly pestana = signal<PestanaCandy>('productos');

  // --- Categorías ---
  readonly categorias = signal<CategoriaProducto[]>([]);
  readonly cargandoCategorias = signal<boolean>(true);
  readonly guardandoCategoria = signal<boolean>(false);
  readonly categoriaEditandoId = signal<string | null>(null);
  readonly categoriaAEliminar = signal<CategoriaProducto | null>(null);

  readonly formCategoria = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    orden: [0, [Validators.required, Validators.min(0)]],
    activa: [true],
  });

  // --- Productos ---
  readonly productos = signal<ProductoAdminItem[]>([]);
  readonly totalProductos = signal<number>(0);
  readonly paginaProductos = signal<number>(1);
  readonly tamanioPagina = 10;
  readonly filtroCategoriaId = signal<string>('todas');
  readonly filtroBusqueda = signal<string>('');
  readonly cargandoProductos = signal<boolean>(true);
  readonly guardandoProducto = signal<boolean>(false);
  readonly productoEditandoId = signal<string | null>(null);
  readonly archivoProducto = signal<File | null>(null);
  readonly previewProductoUrl = signal<string | null>(null);

  readonly totalPaginasProductos = computed(() =>
    Math.max(1, Math.ceil(this.totalProductos() / this.tamanioPagina))
  );

  readonly formProducto = this.fb.nonNullable.group({
    categoria_id: ['', [Validators.required]],
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    descripcion: [''],
    precio: [1000, [Validators.required, Validators.min(1)]],
    activo: [true],
  });

  // --- Combos ---
  readonly combos = signal<ComboAdminItem[]>([]);
  readonly productosParaCombo = signal<Producto[]>([]);
  readonly precioBaseTipicoEntrada = signal<number>(8000);
  readonly cargandoCombos = signal<boolean>(true);
  readonly guardandoCombo = signal<boolean>(false);
  readonly comboEditandoId = signal<string | null>(null);
  readonly archivoCombo = signal<File | null>(null);
  readonly previewComboUrl = signal<string | null>(null);

  readonly formCombo = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    descripcion: [''],
    precio: [5000, [Validators.required, Validators.min(1)]],
    incluye_entradas: [0, [Validators.required, Validators.min(0), Validators.max(8)]],
    destacado: [true],
    activo: [true],
    items: this.fb.array([]),
  });

  get comboItemsArray(): FormArray {
    return this.formCombo.get('items') as FormArray;
  }

  // Valor sin combo calculado reactivamente al editar o crear
  readonly valorSinComboForm = signal<number>(0);
  readonly ahorroComboForm = computed(() => {
    const sinCombo = this.valorSinComboForm();
    const precioCombo = Number(this.formCombo.get('precio')?.value) || 0;
    return sinCombo - precioCombo;
  });

  async ngOnInit(): Promise<void> {
    this.agregarFilaItemCombo();
    this.formCombo.valueChanges.subscribe(() => this.recalcularValorSinCombo());

    await Promise.all([
      this.cargarCategorias(),
      this.cargarProductos(),
      this.cargarCombosYCatalogo(),
    ]);
  }

  seleccionarPestana(tab: PestanaCandy): void {
    this.pestana.set(tab);
  }

  // =========================================================================
  // CATEGORÍAS
  // =========================================================================

  async cargarCategorias(): Promise<void> {
    this.cargandoCategorias.set(true);
    const res = await this.candyService.listarCategorias();
    if (res.ok) {
      this.categorias.set(res.data);
      if (!this.formProducto.value.categoria_id && res.data.length > 0) {
        const primeraActiva = res.data.find((c) => c.activa) ?? res.data[0];
        this.formProducto.patchValue({ categoria_id: primeraActiva.id });
      }
    } else {
      this.toast.error(res.error);
    }
    this.cargandoCategorias.set(false);
  }

  editarCategoria(cat: CategoriaProducto): void {
    this.categoriaEditandoId.set(cat.id);
    this.formCategoria.setValue({
      nombre: cat.nombre,
      orden: cat.orden,
      activa: cat.activa,
    });
  }

  cancelarEdicionCategoria(): void {
    this.categoriaEditandoId.set(null);
    this.formCategoria.reset({ nombre: '', orden: 0, activa: true });
  }

  async guardarCategoria(): Promise<void> {
    if (this.formCategoria.invalid || this.guardandoCategoria()) return;
    this.guardandoCategoria.set(true);

    const dto = this.formCategoria.getRawValue();
    const editId = this.categoriaEditandoId();
    const res = editId
      ? await this.candyService.editarCategoria(editId, dto)
      : await this.candyService.crearCategoria(dto);

    this.guardandoCategoria.set(false);

    if (!res.ok) {
      this.toast.error(res.error);
      return;
    }

    this.toast.exito(editId ? 'Categoría actualizada.' : 'Categoría creada.');
    this.cancelarEdicionCategoria();
    await this.cargarCategorias();
  }

  async toggleCategoria(cat: CategoriaProducto): Promise<void> {
    const res = await this.candyService.cambiarEstadoCategoria(cat.id, !cat.activa);
    if (!res.ok) {
      this.toast.error(res.error);
      return;
    }
    this.toast.exito(cat.activa ? 'Categoría desactivada.' : 'Categoría activada.');
    await this.cargarCategorias();
  }

  solicitarEliminarCategoria(cat: CategoriaProducto): void {
    this.categoriaAEliminar.set(cat);
  }

  async confirmarEliminarCategoria(): Promise<void> {
    const cat = this.categoriaAEliminar();
    if (!cat) return;
    this.categoriaAEliminar.set(null);

    const res = await this.candyService.eliminarCategoria(cat.id);
    if (!res.ok) {
      this.toast.error(res.error);
      return;
    }
    this.toast.exito('Categoría eliminada.');
    await this.cargarCategorias();
  }

  // =========================================================================
  // PRODUCTOS
  // =========================================================================

  async cargarProductos(): Promise<void> {
    this.cargandoProductos.set(true);
    const res = await this.candyService.listarProductosAdmin({
      categoriaId: this.filtroCategoriaId(),
      busqueda: this.filtroBusqueda(),
      pagina: this.paginaProductos(),
      tamanioPagina: this.tamanioPagina,
    });

    if (res.ok) {
      this.productos.set(res.data.items);
      this.totalProductos.set(res.data.total);
    } else {
      this.toast.error(res.error);
    }
    this.cargandoProductos.set(false);
  }

  onFiltroCategoriaChange(categoriaId: string): void {
    this.filtroCategoriaId.set(categoriaId);
    this.paginaProductos.set(1);
    void this.cargarProductos();
  }

  onFiltroBusquedaChange(termino: string): void {
    this.filtroBusqueda.set(termino);
    this.paginaProductos.set(1);
    void this.cargarProductos();
  }

  cambiarPaginaProductos(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginasProductos()) return;
    this.paginaProductos.set(pagina);
    void this.cargarProductos();
  }

  onSeleccionarImagenProducto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.archivoProducto.set(file);
    this.previewProductoUrl.set(file ? URL.createObjectURL(file) : null);
  }

  editarProducto(prod: ProductoAdminItem): void {
    this.productoEditandoId.set(prod.id);
    this.archivoProducto.set(null);
    this.previewProductoUrl.set(prod.imagen_url);
    this.formProducto.setValue({
      categoria_id: prod.categoria_id,
      nombre: prod.nombre,
      descripcion: prod.descripcion ?? '',
      precio: Number(prod.precio),
      activo: prod.activo,
    });
  }

  cancelarEdicionProducto(): void {
    this.productoEditandoId.set(null);
    this.archivoProducto.set(null);
    this.previewProductoUrl.set(null);
    const catDefault = this.categorias().find((c) => c.activa)?.id ?? this.categorias()[0]?.id ?? '';
    this.formProducto.reset({
      categoria_id: catDefault,
      nombre: '',
      descripcion: '',
      precio: 1000,
      activo: true,
    });
  }

  async guardarProducto(): Promise<void> {
    if (this.formProducto.invalid || this.guardandoProducto()) return;
    this.guardandoProducto.set(true);

    const raw = this.formProducto.getRawValue();
    const dto = {
      categoria_id: raw.categoria_id,
      nombre: raw.nombre,
      descripcion: raw.descripcion || null,
      precio: Number(raw.precio),
      activo: raw.activo,
    };

    const editId = this.productoEditandoId();
    const res = editId
      ? await this.candyService.editarProducto(editId, dto, this.archivoProducto())
      : await this.candyService.crearProducto(dto, this.archivoProducto());

    this.guardandoProducto.set(false);

    if (!res.ok) {
      this.toast.error(res.error);
      return;
    }

    this.toast.exito(editId ? 'Producto actualizado.' : 'Producto creado.');
    this.cancelarEdicionProducto();
    await Promise.all([this.cargarProductos(), this.cargarCombosYCatalogo()]);
  }

  async toggleProducto(prod: ProductoAdminItem): Promise<void> {
    const res = await this.candyService.cambiarEstadoProducto(prod.id, !prod.activo);
    if (!res.ok) {
      this.toast.error(res.error);
      return;
    }
    this.toast.exito(prod.activo ? 'Producto desactivado.' : 'Producto activado.');
    await Promise.all([this.cargarProductos(), this.cargarCombosYCatalogo()]);
  }

  // =========================================================================
  // COMBOS
  // =========================================================================

  async cargarCombosYCatalogo(): Promise<void> {
    this.cargandoCombos.set(true);
    const [resCombos, resProdsActivos, precioEntrada] = await Promise.all([
      this.candyService.listarCombosAdmin(),
      this.candyService.listarProductosActivosParaCombo(),
      this.candyService.obtenerPrecioBaseTipicoEntrada(),
    ]);

    if (resCombos.ok) {
      this.combos.set(resCombos.data);
    } else {
      this.toast.error(resCombos.error);
    }

    if (resProdsActivos.ok) {
      this.productosParaCombo.set(resProdsActivos.data);
    }

    this.precioBaseTipicoEntrada.set(precioEntrada);
    this.recalcularValorSinCombo();
    this.cargandoCombos.set(false);
  }

  agregarFilaItemCombo(productoId = '', cantidad = 1): void {
    const fila = this.fb.nonNullable.group({
      producto_id: [productoId, [Validators.required]],
      cantidad: [cantidad, [Validators.required, Validators.min(1), Validators.max(20)]],
    });
    this.comboItemsArray.push(fila);
    this.recalcularValorSinCombo();
  }

  quitarFilaItemCombo(index: number): void {
    if (this.comboItemsArray.length <= 1) return;
    this.comboItemsArray.removeAt(index);
    this.recalcularValorSinCombo();
  }

  onSeleccionarImagenCombo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.archivoCombo.set(file);
    this.previewComboUrl.set(file ? URL.createObjectURL(file) : null);
  }

  recalcularValorSinCombo(): void {
    const preciosPorId = new Map<string, number>();
    for (const p of this.productosParaCombo()) {
      preciosPorId.set(p.id, Number(p.precio));
    }

    let totalProductos = 0;
    for (const ctrl of this.comboItemsArray.controls) {
      const pid = String(ctrl.get('producto_id')?.value ?? '');
      const cant = Number(ctrl.get('cantidad')?.value ?? 0);
      if (pid && cant > 0) {
        totalProductos += (preciosPorId.get(pid) ?? 0) * cant;
      }
    }

    const cantEntradas = Math.max(0, Number(this.formCombo.get('incluye_entradas')?.value ?? 0));
    const totalEntradas = cantEntradas * this.precioBaseTipicoEntrada();
    this.valorSinComboForm.set(totalProductos + totalEntradas);
  }

  calcularValorSinComboDeItem(combo: ComboAdminItem): number {
    const sumaProds = combo.items.reduce(
      (acc, i) => acc + i.producto_precio * i.cantidad,
      0
    );
    return sumaProds + combo.incluye_entradas * this.precioBaseTipicoEntrada();
  }

  editarCombo(combo: ComboAdminItem): void {
    this.comboEditandoId.set(combo.id);
    this.archivoCombo.set(null);
    this.previewComboUrl.set(combo.imagen_url);

    this.comboItemsArray.clear();
    if (combo.items.length > 0) {
      for (const item of combo.items) {
        this.agregarFilaItemCombo(item.producto_id, item.cantidad);
      }
    } else {
      this.agregarFilaItemCombo();
    }

    this.formCombo.patchValue({
      nombre: combo.nombre,
      descripcion: combo.descripcion ?? '',
      precio: Number(combo.precio),
      incluye_entradas: combo.incluye_entradas,
      destacado: combo.destacado,
      activo: combo.activo,
    });
    this.recalcularValorSinCombo();
  }

  cancelarEdicionCombo(): void {
    this.comboEditandoId.set(null);
    this.archivoCombo.set(null);
    this.previewComboUrl.set(null);
    this.comboItemsArray.clear();
    this.agregarFilaItemCombo();
    this.formCombo.reset({
      nombre: '',
      descripcion: '',
      precio: 5000,
      incluye_entradas: 0,
      destacado: true,
      activo: true,
    });
    this.recalcularValorSinCombo();
  }

  async guardarCombo(): Promise<void> {
    if (this.formCombo.invalid || this.guardandoCombo()) return;

    const raw = this.formCombo.getRawValue();
    const itemsLimpios = raw.items as Array<{ producto_id: string; cantidad: number }>;

    // Validar que no se repita el mismo producto en dos filas
    const idsUnicos = new Set(itemsLimpios.map((i) => i.producto_id));
    if (idsUnicos.size !== itemsLimpios.length) {
      this.toast.error('No repitas el mismo producto en dos filas; sumá la cantidad en una sola.');
      return;
    }

    this.guardandoCombo.set(true);
    const editId = this.comboEditandoId();
    const dto = {
      nombre: raw.nombre,
      descripcion: raw.descripcion || null,
      precio: Number(raw.precio),
      incluye_entradas: Number(raw.incluye_entradas),
      destacado: raw.destacado,
      activo: raw.activo,
      items: itemsLimpios,
    };

    const res = editId
      ? await this.candyService.editarCombo(editId, dto, this.archivoCombo())
      : await this.candyService.crearCombo(dto, this.archivoCombo());

    this.guardandoCombo.set(false);

    if (!res.ok) {
      this.toast.error(res.error);
      return;
    }

    this.toast.exito(editId ? 'Combo actualizado.' : 'Combo creado.');
    this.cancelarEdicionCombo();
    await this.cargarCombosYCatalogo();
  }

  async toggleCombo(combo: ComboAdminItem): Promise<void> {
    const res = await this.candyService.cambiarEstadoCombo(combo.id, !combo.activo);
    if (!res.ok) {
      this.toast.error(res.error);
      return;
    }
    this.toast.exito(combo.activo ? 'Combo desactivado.' : 'Combo activado.');
    await this.cargarCombosYCatalogo();
  } 
}