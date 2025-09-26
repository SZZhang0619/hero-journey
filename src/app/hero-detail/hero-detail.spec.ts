import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeroDetail } from './hero-detail';

describe('HeroDetail', () => {
  let component: HeroDetail;
  let fixture: ComponentFixture<HeroDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HeroDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
