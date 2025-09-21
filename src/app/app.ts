import { Component, signal } from '@angular/core';
import { HeroBadge } from './hero-badge/hero-badge';

type Hero = { id: number; name: string; rank?: string };

@Component({
  selector: 'app-root',
  imports: [HeroBadge],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('hero-journey');

  protected readonly heroes = signal<Hero[]>([
    { id: 11, name: 'Dr Nice', rank: 'B' },
    { id: 12, name: 'Narco', rank: 'A' },
    { id: 13, name: 'Bombasto' },
    { id: 14, name: 'Celeritas', rank: 'S' },
  ]);

  // 新增：目前選中的英雄
  protected readonly selectedHero = signal<Hero | null>(null);

  constructor() {
    this.heroes.set([]);
  }

  // 新增：點擊處理
  onSelect(hero: Hero) {
    const cur = this.selectedHero();
    this.selectedHero.set(cur?.id === hero.id ? null : hero);
  }
}
