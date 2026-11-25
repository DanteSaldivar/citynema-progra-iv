import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { ComprasService } from '../compras.service';
import { DatePipe, SlicePipe, UpperCasePipe } from '@angular/common';

@Component({
  imports: [RouterLink, DatePipe, UpperCasePipe, SlicePipe],
  selector: 'app-exito-compra',
  styleUrl: './exito-compra.component.css',
  templateUrl: './exito-compra.component.html',
})
export class ExitoCompraComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private comprasService = inject(ComprasService);

  cargando = signal(true);
  generandoPDF = signal(false);
  orden = signal<any>(null);
  fechaConfirmacion = signal<Date | null>(null);
  private ordenIdString = '';

  ngOnInit() {
    const ordenId = this.route.snapshot.paramMap.get('ordenId');
    if (ordenId) {
      this.ordenIdString = ordenId;
      this.cargarOrden(ordenId);
    }
    this.fechaConfirmacion.set(new Date());
  }

  async cargarOrden(ordenId: string) {
    try {
      const data = await this.comprasService.getOrdenCompleta(ordenId);

      // Pre-generar los códigos QR en Base64 para mostrarlos en el HTML nativo
      for (const entrada of data.entradas) {
        entrada.qrDataUrl = await QRCode.toDataURL(entrada.codigo_qr, { width: 150, margin: 1 });
      }

      if (data.codigo_candy) {
        data.qrCandyDataUrl = await QRCode.toDataURL(data.codigo_candy, { width: 150, margin: 1 });
      }

      this.orden.set(data);
    } catch (e) {
      console.error(e);
    } finally {
      this.cargando.set(false);
    }
  }
  async descargarPDF() {
    const data = this.orden();
    if (!data) return;

    this.generandoPDF.set(true);

    try {
      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const purple: [number, number, number] = [138, 82, 229];
      const dark: [number, number, number] = [30, 30, 40];
      const muted: [number, number, number] = [105, 105, 120];
      const margin = 18;
      let y = 20;

      // Marca y confirmación
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(30);
      doc.setTextColor(...dark);
      doc.text('city', 72, y);
      doc.setTextColor(...purple);
      doc.text('Nema', 90, y);

      y += 10;
      doc.setDrawColor(...purple);
      doc.line(margin, y, pageW - margin, y);
      y += 10;

      doc.setFontSize(16);
      doc.setTextColor(...dark);
      doc.text('¡Muchas gracias por confiar en nosotros!', pageW / 2, y, {
        align: 'center'
      });

      y += 8;
      doc.setFontSize(11);
      doc.setTextColor(...purple);
      doc.text('Compra confirmada', pageW / 2, y, { align: 'center' });

      y += 6;
      doc.setFontSize(9);
      doc.setTextColor(...muted);
      doc.text(new Date().toLocaleString('es-AR'), pageW / 2, y, {
        align: 'center'
      });

      y += 12;
      doc.setFontSize(15);
      doc.setTextColor(...dark);
      doc.text('Tus entradas', margin, y);
      y += 8;

      // Entradas de cine
      for (const entrada of data.entradas) {
        const pelicula = entrada.funciones.peliculas;
        const fecha = new Date(entrada.funciones.inicio).toLocaleString('es-AR');
        const alto = pelicula.clasificacion !== 'atp' ? 48 : 40;

        if (y + alto > pageH - 18) {
          doc.addPage();
          y = 20;
        }

        doc.setFillColor(250, 249, 253);
        doc.setDrawColor(220, 215, 230);
        doc.roundedRect(margin, y, pageW - margin * 2, alto, 2, 2, 'FD');
        doc.setFillColor(...purple);
        doc.rect(margin, y, 2, alto, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(...dark);
        doc.text(pelicula.titulo, margin + 7, y + 8, {
          maxWidth: 105
        });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...muted);
        doc.text(`Fecha: ${fecha}`, margin + 7, y + 16);
        doc.text(`Sala: ${entrada.funciones.salas.nombre}`, margin + 7, y + 22);
        doc.text(`Butaca: ${entrada.tipo_butaca.toUpperCase()}`, margin + 7, y + 28);
        doc.text(`Ticket: ${entrada.id.split('-')[0]}`, margin + 7, y + 34);

        if (pelicula.clasificacion !== 'atp') {
          doc.setTextColor(190, 45, 45);
          doc.setFontSize(8);
          doc.text(`Clasificación: ${pelicula.clasificacion}. Menores con adulto.`, margin + 7, y + 41);
        }

        if (entrada.qrDataUrl) {
          doc.addImage(entrada.qrDataUrl, 'PNG', pageW - margin - 37, y + 3, 32, 32);
        }

        y += alto + 6;
      }

      // Candy Bar
      if (data.orden_productos?.length) {
        if (y + 45 > pageH - 18) {
          doc.addPage();
          y = 20;
        }

        y += 3;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.setTextColor(...dark);
        doc.text('Retiro de Candy Bar', margin, y);
        y += 8;

        const alto = Math.max(38, 15 + data.orden_productos.length * 6);
        doc.setFillColor(250, 249, 253);
        doc.setDrawColor(220, 215, 230);
        doc.roundedRect(margin, y, pageW - margin * 2, alto, 2, 2, 'FD');
        doc.setFillColor(...purple);
        doc.rect(margin, y, 2, alto, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...muted);
        data.orden_productos.forEach((item: any, i: number) =>
          doc.text(`${item.cantidad}x ${item.productos.nombre}`, margin + 7, y + 9 + i * 6)
        );

        if (data.qrCandyDataUrl) {
          doc.addImage(data.qrCandyDataUrl, 'PNG', pageW - margin - 37, y + 3, 32, 32);
        }
      }

      // Pie de página
      for (let i = 1; i <= doc.getNumberOfPages(); i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(...muted);
        doc.text(`cityNema · Página ${i}/${doc.getNumberOfPages()}`, pageW / 2, pageH - 8, {
          align: 'center'
        });
      }

      doc.save(`entradas-orden-${this.ordenIdString.split('-')[0]}.pdf`);
    } catch (e) {
      console.error('Error al generar el PDF', e);
    } finally {
      this.generandoPDF.set(false);
    }
  }

}
