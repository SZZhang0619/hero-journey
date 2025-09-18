import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeroBadge } from './hero-badge';

describe('HeroBadge', () => {
  let component: HeroBadge;
  let fixture: ComponentFixture<HeroBadge>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroBadge]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HeroBadge);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
