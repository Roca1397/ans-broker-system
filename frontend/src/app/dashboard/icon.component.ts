import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

const ICONS: Record<string, string> = {
  'layers':        'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  'clock':         'M12 2a10 10 0 110 20A10 10 0 0112 2zm0 6v4l3 3',
  'activity':      'M22 12h-4l-3 9L9 3l-3 9H2',
  'users':         'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zm12 14v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  'alert-triangle':'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01',
  'zap':           'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  'check-circle':  'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3',
  'bar-chart':     'M18 20V10M12 20V4M6 20v-6',
  'bell':          'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0',
  'shield':        'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  'info':          'M12 2a10 10 0 110 20A10 10 0 0112 2zm0 8v4m0 4h.01',
  'x-circle':      'M12 2a10 10 0 110 20A10 10 0 0112 2zm4.95-4.95l-9.9 9.9m0-9.9l9.9 9.9',
  'refresh':       'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
  'trending-up':   'M23 6l-9.5 9.5-5-5L1 18',
  'trending-down': 'M23 18l-9.5-9.5-5 5L1 6',
  'user':          'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z',
  'link':          'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
};

@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
      <path [attr.d]="pathData"/>
    </svg>
  `,
})
export class IconComponent {
  @Input() name = '';
  @Input() size = 16;

  get pathData(): string {
    return ICONS[this.name] ?? '';
  }
}
