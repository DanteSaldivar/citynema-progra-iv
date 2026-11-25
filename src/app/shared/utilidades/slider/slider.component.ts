import { Component, ElementRef, input, viewChild } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-slider',
  styleUrl: './slider.component.css',
  templateUrl: './slider.component.html',
})
export class SliderComponent {

  slider = viewChild<ElementRef<HTMLDivElement>>('slider');

  desplazamiento = input<number>(0.8);

  deslizar(direccion: 'izquierda' | 'derecha') {

    const elemento = this.slider()?.nativeElement;

    if (!elemento) return;

    const cantidad = elemento.clientWidth * this.desplazamiento();

    elemento.scrollBy({
      left: direccion === 'derecha'
        ? cantidad
        : -cantidad,

      behavior: 'smooth'
    });
  }
  
}
