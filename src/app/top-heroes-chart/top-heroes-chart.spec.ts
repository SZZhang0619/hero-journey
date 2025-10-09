import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TopHeroesChart } from './top-heroes-chart';

describe('TopHeroesChart', () => {
  let component: TopHeroesChart;
  let fixture: ComponentFixture<TopHeroesChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopHeroesChart]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TopHeroesChart);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
