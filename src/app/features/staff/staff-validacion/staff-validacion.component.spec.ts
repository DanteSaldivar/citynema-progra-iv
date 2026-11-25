import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StaffValidacionComponent } from './staff-validacion.component';

describe('StaffValidacionComponent', () => {
  let component: StaffValidacionComponent;
  let fixture: ComponentFixture<StaffValidacionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaffValidacionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StaffValidacionComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
