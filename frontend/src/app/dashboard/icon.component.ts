import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

const ICONS: Record<string, string> = {
  'trending-up':   'M3 17l5-5 4 4 7-8',
  'trending-down': 'M3 7l5 5 4-4 7 8',
  'alert-triangle':'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01',
  'check-circle':  'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3',
  'clock':         'M12 2a10 10 0 110 20A10 10 0 0112 2zm0 6v6l4 2',
  'users':         'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zm12 14v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  'bar-chart':     'M18 20V10M12 20V4M6 20v-6',
  'activity':      'M22 12h-4l-3 9L9 3l-3 9H2',
  'bell':          'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0',
  'zap':           'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  'shield':        'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  'info':          'M12 2a10 10 0 110 20A10 10 0 0112 2zm0 8v4m0 4h.01',
  'x-circle':      'M12 2a10 10 0 110 20A10 10 0 0112 2zm4-6l-8 8m0-8l8 8',
  'arrow-up':      'M12 19V5m-7 7l7-7 7 7',
  'arrow-down':    'M12 5v14m7-7l-7 7-7-7',
  'refresh':       'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
};

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
      <path *ngFor="let p of paths" [attr.d]="p"/>
    </svg>
  `,
})
export class IconComponent {
  @Input() name = '';
  @Input() size = 16;

  get paths(): string[] {
    const d = ICONS[this.name] ?? '';
    return d ? d.split('M').filter(Boolean).map((s, i) => (i === 0 ? 'M' : 'M') + s) : [];
  }
}
