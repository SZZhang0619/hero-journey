import { Component, computed, inject, input } from '@angular/core';
import { Hero, HeroService } from '../hero.service';
import { LoadingSpinner } from '../ui/loading-spinner/loading-spinner';
import { MessageBanner } from '../ui/message-banner/message-banner';
import { RouterModule } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-hero-detail',
  imports: [RouterModule, NgOptimizedImage, LoadingSpinner, MessageBanner],
  templateUrl: './hero-detail.html',
  styleUrl: './hero-detail.scss',
})
export class HeroDetail {
  // 由 withComponentInputBinding() 自動把 route param `id` 綁進來
  readonly id = input.required<number>();

  private readonly heroService = inject(HeroService);

  readonly heroResource = rxResource<Hero | null, number>({
    params: () => this.id(),
    stream: ({ params, abortSignal }) =>
      this.heroService.getById(params, { signal: abortSignal }),
    defaultValue: null,
  });

  readonly hero = computed<Hero | null>(() => this.heroResource.value());
  readonly loading = computed(() => this.heroResource.isLoading());
  readonly errorMessage = computed(() => {
    const err = this.heroResource.error();
    if (!err) {
      return null;
    }
    return err instanceof Error ? err.message : String(err);
  });
  readonly avatarUrl = computed(() => {
    const detail = this.hero();
    if (!detail) {
      return null;
    }

    const seed = encodeURIComponent(detail.name);
    return `https://api.dicebear.com/7.x/bottts-neutral/png?seed=${seed}&size=320&background=%23eef3ff`;
  });
  readonly battleAnalysis = computed(() => {
    const detail = this.hero();
    if (!detail) {
      return null;
    }

    const skillsCount = detail.skills?.length ?? 0;
    const rankBoost = (() => {
      switch (detail.rank) {
        case 'S':
          return { win: 18, mvp: 22 };
        case 'A':
          return { win: 12, mvp: 14 };
        case 'B':
          return { win: 6, mvp: 8 };
        case 'C':
          return { win: 2, mvp: 4 };
        default:
          return { win: 0, mvp: 0 };
      }
    })();

    const missions = 32 + (detail.id % 7) * 5 + skillsCount * 3;
    const winRate = Math.min(98, 68 + rankBoost.win + skillsCount * 2);
    const mvpRate = Math.min(72, 18 + rankBoost.mvp + skillsCount * 4);
    const avgDuration = Math.max(9, 28 - rankBoost.win / 2 - skillsCount * 1.5);

    return {
      missions,
      winRate,
      mvpRate,
      avgDuration: Number(avgDuration.toFixed(1)),
      synergyScore: Math.min(100, Math.round((winRate * 0.6 + mvpRate * 0.4))),
    };
  });

  reload() {
    this.heroResource.reload();
  }
}
