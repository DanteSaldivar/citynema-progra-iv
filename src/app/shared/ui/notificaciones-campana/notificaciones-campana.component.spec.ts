import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificacionesCampanaComponent } from './notificaciones-campana.component';

describe('NotificacionesCampanaComponent', () => {
  let component: NotificacionesCampanaComponent;
  let fixture: ComponentFixture<NotificacionesCampanaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificacionesCampanaComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificacionesCampanaComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
