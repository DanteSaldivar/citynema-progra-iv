import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminReportesService } from '../admin-reportes.service';
import jsPDF from 'jspdf';

@Component({
  imports: [CommonModule],
  selector: 'app-admin-dashboard',
  styleUrl: './admin-dashboard.component.css',
  templateUrl: './admin-dashboard.component.html',
})
export class AdminDashboardComponent implements OnInit {

  private reportesService = inject(AdminReportesService);

  cargando = signal(true);
  datos = signal<any>({ facturacionDiaria: 0, entradasVendidas: 0, topPeliculas: [], topCandy: [], auditoria: [] });

  ngOnInit() {
    this.cargarDatos();
  }

  async cargarDatos() {
    try {
      const data = await this.reportesService.getDashboardData();
      this.datos.set(data);
    } catch (error) {
      console.error("Error al cargar dashboard", error);
    } finally {
      this.cargando.set(false);
    }
  }

  calcularPorcentaje(vistas: number): number {
    const max = this.datos().topPeliculas[0]?.vistas || 1;
    return (vistas / max) * 100;
  }

  exportarExcel() {
    // Generar CSV nativo (reconocido como Excel) sin dependencias pesadas
    const d = this.datos();
    const headers = "Fecha Reporte,Facturacion Diaria,Entradas Vendidas\n";
    const row = `${new Date().toLocaleDateString()},${d.facturacionDiaria},${d.entradasVendidas}\n`;
    
    const blob = new Blob([headers + row], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `reporte_cine_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportarPDF() {
    const doc = new jsPDF();
    const d = this.datos();
    
    doc.setFontSize(20);
    doc.text('Reporte de Dirección del Cine', 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Fecha de emisión: ${new Date().toLocaleString()}`, 20, 30);
    
    doc.setFontSize(14);
    doc.text(`Resumen del Día`, 20, 50);
    doc.setFontSize(12);
    doc.text(`- Facturación Total: $${d.facturacionDiaria}`, 20, 60);
    doc.text(`- Entradas Vendidas: ${d.entradasVendidas} unidades`, 20, 70);
    
    doc.save(`reporte_admin_${new Date().toISOString().split('T')[0]}.pdf`);
  }

}
