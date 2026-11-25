import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminFuncionesComponent } from './admin-funciones.component';

describe('AdminFuncionesComponent', () => {
  let component: AdminFuncionesComponent;
  let fixture: ComponentFixture<AdminFuncionesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminFuncionesComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminFuncionesComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
