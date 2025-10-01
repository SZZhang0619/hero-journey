import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';

type BannerType = 'info' | 'error' | 'success';

@Component({
  selector: 'app-message-banner',
  standalone: true,
  imports: [NgClass],
  templateUrl: './message-banner.html',
  styleUrl: './message-banner.scss',
})
export class MessageBanner {
  @Input() type: BannerType = 'info';

  get roleAttr(): string | null {
    return this.type === 'error' ? 'alert' : null;
  }

  get ariaLiveAttr(): 'polite' | 'assertive' {
    return this.type === 'error' ? 'assertive' : 'polite';
  }
}
