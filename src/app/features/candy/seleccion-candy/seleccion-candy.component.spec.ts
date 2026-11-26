import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SeleccionCandyComponent } from './seleccion-candy.component';

describe('SeleccionCandyComponent', () => {
  let component: SeleccionCandyComponent;
  let fixture: ComponentFixture<SeleccionCandyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeleccionCandyComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SeleccionCandyComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
