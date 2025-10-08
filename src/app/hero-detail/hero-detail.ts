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

  reload() {
    this.heroResource.reload();
  }
}
