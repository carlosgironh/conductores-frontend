import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { SafeResourceUrl, DomSanitizer } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  template: `
    <ion-content [fullscreen]="true">
      <iframe 
        [src]="safeUrl" 
        style="width: 100%; height: 100%; border: none;"
        allow="camera; microphone; geolocation">
      </iframe>
    </ion-content>
  `,
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule]
})
export class HomePage {
  safeUrl: SafeResourceUrl;

  constructor(private sanitizer: DomSanitizer) {
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl('https://nrdesingcorp.com/');
  }
}