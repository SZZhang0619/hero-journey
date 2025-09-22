import { Component, signal } from '@angular/core';
import { HeroBadge } from './hero-badge/hero-badge';
import { FormsModule } from '@angular/forms';

type Hero = { id: number; name: string; rank?: string };

@Component({
  selector: 'app-root',
  imports: [HeroBadge, FormsModule],
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

  // 目前選中的英雄
  protected readonly selectedHero = signal<Hero | null>(null);

  constructor() {
    this.heroes.set([]);
  }

  // 點擊處理
  onSelect(hero: Hero) {
    const cur = this.selectedHero();
    this.selectedHero.set(cur?.id === hero.id ? null : hero);
  }

  // 新增：同步更新 selectedHero 與 heroes 清單
  updateName(name: string) {
    const selected = this.selectedHero();
    if (!selected) {
      return;
    }

    // 1. 建立更新後的英雄物件
    const updatedHero = { ...selected, name };

    // 2. 更新英雄列表 (heroes signal)
    this.heroes.update((list) =>
      list.map((hero) => (hero.id === updatedHero.id ? updatedHero : hero))
    );

    // 3. 更新當前選取的英雄 (selectedHero signal)
    this.selectedHero.set(updatedHero);
  }
}
