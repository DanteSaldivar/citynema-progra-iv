import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CuentaDashboardComponent } from './cuenta-dashboard.component';

describe('CuentaDashboardComponent', () => {
  let component: CuentaDashboardComponent;
  let fixture: ComponentFixture<CuentaDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CuentaDashboardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CuentaDashboardComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
