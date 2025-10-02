import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { Hero, HeroService } from '../hero.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'app-hero-detail',
  imports: [RouterModule, NgOptimizedImage],
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
  readonly avatarUrl = computed(() => {
    const hero = this.hero();
    if (!hero) {
      return null;
    }
    const seed = encodeURIComponent(hero.name);
    return `https://api.dicebear.com/7.x/bottts-neutral/png?seed=${seed}&size=320&background=%23eef3ff`;
  });

  constructor() {
    // 當 id 改變時重新載入
    effect(() => {
      const curId = Number(this.id());
      this.loading.set(true);
      this.error.set(null);
      this.loadHero(curId);
    });
  }

  private loadHero(id: number) {
    this.heroService
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (h) => {
          this.hero.set(h ?? null);
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(String(e ?? 'Unknown error'));
          this.loading.set(false);
        },
      });
  }
}
