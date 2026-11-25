import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExitoCompraComponent } from './exito-compra.component';

describe('ExitoCompraComponent', () => {
  let component: ExitoCompraComponent;
  let fixture: ComponentFixture<ExitoCompraComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExitoCompraComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ExitoCompraComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
