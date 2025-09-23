import { Component, inject, signal } from '@angular/core';
import { HeroService, Hero } from './hero.service';
import { HeroBadge } from './hero-badge/hero-badge';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  imports: [HeroBadge, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  // 使用 inject() 取得 HeroService
  private readonly heroService = inject(HeroService);

  protected readonly title = signal('hero-journey');

  // 由服務提供初始資料
  protected readonly heroes = signal<Hero[]>(this.heroService.getAll());

  // 目前選中的英雄
  protected readonly selectedHero = signal<Hero | null>(null);

  // constructor() {
  //   this.heroes.set([]);
  // }

  // 點擊處理
  onSelect(hero: Hero) {
    const cur = this.selectedHero();
    this.selectedHero.set(cur?.id === hero.id ? null : hero);
  }

  // 調整：讓服務處理邏輯，再回傳至元件將資料顯示
  updateName(name: string) {
    const selected = this.selectedHero();
    if (!selected) {
      return;
    }

    const updated = this.heroService.updateName(selected.id, name);
    if (!updated) {
      return;
    }

    this.heroes.update((list) =>
      list.map((hero) => (hero.id === selected.id ? { ...hero, name: updated.name } : hero))
    );
    this.selectedHero.set({ ...selected, name: updated.name });
  }
}
