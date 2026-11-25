import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PeliculaCarruselComponent } from './pelicula-carrusel.component';

describe('PeliculaCarruselComponent', () => {
  let component: PeliculaCarruselComponent;
  let fixture: ComponentFixture<PeliculaCarruselComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PeliculaCarruselComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PeliculaCarruselComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
