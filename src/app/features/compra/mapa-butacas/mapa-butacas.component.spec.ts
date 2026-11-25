import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapaButacasComponent } from './mapa-butacas.component';

describe('MapaButacasComponent', () => {
  let component: MapaButacasComponent;
  let fixture: ComponentFixture<MapaButacasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapaButacasComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MapaButacasComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
