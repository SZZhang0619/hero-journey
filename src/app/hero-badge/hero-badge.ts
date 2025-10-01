import { Component, input } from '@angular/core';

@Component({
  selector: 'app-hero-badge',
  standalone: true,
  imports: [],
  templateUrl: './hero-badge.html',
  styleUrl: './hero-badge.scss',
})
export class HeroBadge {
  readonly rank = input<string | undefined>();
}
