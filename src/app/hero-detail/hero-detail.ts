import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { Hero, HeroService } from '../hero.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-hero-detail',
  imports: [RouterModule],
  templateUrl: './hero-detail.html',
  styleUrl: './hero-detail.scss',
})
export class HeroDetail {
  // 由 withComponentInputBinding() 自動把 route param `id` 綁進來
  readonly id = input.required<number>();

  private readonly heroService = inject(HeroService);
  private readonly destroyRef = inject(DestroyRef);

  // 狀態
  readonly hero = signal<Hero | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    // 當 id 改變時重新載入
    effect(() => {
      const curId = Number(this.id());
      this.loading.set(true);
      this.error.set(null);

      // 以 Observable 取得單筆
      const sub = this.heroService
        .getById$(curId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (h) => {
            console.log('hero', h);
            this.hero.set(h ?? null);
            this.loading.set(false);
          },
          error: (e) => {
            this.error.set(String(e ?? 'Unknown error'));
            this.loading.set(false);
          },
        });

      return () => sub.unsubscribe();
    });
  }
}
