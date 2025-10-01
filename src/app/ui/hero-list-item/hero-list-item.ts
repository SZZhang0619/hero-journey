import { Component, computed, input, output } from '@angular/core';
import { Hero } from '../../hero.service';
import { HeroBadge } from '../../hero-badge/hero-badge';

@Component({
  selector: 'app-hero-list-item',
  standalone: true,
  imports: [HeroBadge],
  templateUrl: './hero-list-item.html',
  styleUrl: './hero-list-item.scss',
})
export class HeroListItem {
  readonly hero = input.required<Hero>();
  readonly selectedId = input<number | null>(null);
  readonly selected = computed(() => this.hero().id === this.selectedId());
  readonly pick = output<number>();

  triggerSelect() {
    this.pick.emit(this.hero().id);
  }
}
