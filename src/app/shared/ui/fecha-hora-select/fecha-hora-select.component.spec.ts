import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FechaHoraSelectComponent } from './fecha-hora-select.component';

describe('FechaHoraSelectComponent', () => {
  let component: FechaHoraSelectComponent;
  let fixture: ComponentFixture<FechaHoraSelectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FechaHoraSelectComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FechaHoraSelectComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
