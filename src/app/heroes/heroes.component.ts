import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HeroService, Hero } from '../hero.service';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-heroes',
  imports: [FormsModule],
  templateUrl: './heroes.component.html',
  styleUrl: './heroes.component.scss',
})
export class HeroesComponent {
  // 注入服務與 DestroyRef
  private readonly heroService = inject(HeroService);
  private readonly destroyRef = inject(DestroyRef);

  // 狀態：英雄清單、目前選中的英雄、載入、錯誤
  protected readonly heroes = signal<Hero[]>([]);
  protected readonly selectedHero = signal<Hero | null>(null);
  protected readonly heroesLoading = signal(true);
  protected readonly heroesError = signal<string | null>(null);

  constructor() {
    // 從 Observable 取得資料
    this.heroService
      .getAll$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.heroes.set(list);
          this.heroesLoading.set(false);
        },
        error: (err) => {
          this.heroesError.set(String(err ?? 'Unknown error'));
          this.heroesLoading.set(false);
        },
      });
  }

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
