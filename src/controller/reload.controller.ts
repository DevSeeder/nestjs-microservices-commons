import { Controller, Get } from '@nestjs/common';
import { exec } from 'child_process';

@Controller()
export class ReloadController {
  @Get('/reload')
  reloadApp(): string {
    this.reloadApplication();
    return 'Reloading Application...';
  }

  private reloadApplication(): void {
    exec('pm2 restart all', (error, stdout, stderr) => {
      if (error) {
        console.error(`Reload error: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`Restart error: ${stderr}`);
        return;
      }
      console.log(`Application reloaded!: ${stdout}`);
    });
  }
}
