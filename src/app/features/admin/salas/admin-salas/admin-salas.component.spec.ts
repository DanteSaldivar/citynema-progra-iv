import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminSalasComponent } from './admin-salas.component';

describe('AdminSalasComponent', () => {
  let component: AdminSalasComponent;
  let fixture: ComponentFixture<AdminSalasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminSalasComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminSalasComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
