import { Component, computed, inject, input, signal } from '@angular/core';
import { Hero, HeroService } from '../hero.service';
import { LoadingSpinner } from '../ui/loading-spinner/loading-spinner';
import { MessageBanner } from '../ui/message-banner/message-banner';
import { RouterModule } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap } from 'rxjs';

export type HeroDetailState =
  | { status: 'loading'; hero: null; error: null }
  | { status: 'ready'; hero: Hero; error: null }
  | { status: 'error'; hero: null; error: string };

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

  readonly heroState = toSignal(
    toObservable(this.id).pipe(
      switchMap((id) =>
        this.heroService.getById(id).pipe(
          map((hero) => ({ status: 'ready', hero, error: null } as const)),
          startWith({ status: 'loading', hero: null, error: null } as const),
          catchError((err) =>
            of({
              status: 'error',
              hero: null,
              error: String(err ?? 'Unknown error'),
            } as const)
          )
        )
      )
    ),
    { initialValue: { status: 'loading', hero: null, error: null } }
  );

  readonly hero = computed(() => this.heroState().hero);
  readonly loading = computed(() => this.heroState().status === 'loading');
  readonly error = computed(() => this.heroState().error);
  readonly avatarUrl = computed(() => {
    const detail = this.heroState();
    if (detail.status !== 'ready') {
      return null;
    }
    const seed = encodeURIComponent(detail.hero.name);
    return `https://api.dicebear.com/7.x/bottts-neutral/png?seed=${seed}&size=320&background=%23eef3ff`;
  });
}
