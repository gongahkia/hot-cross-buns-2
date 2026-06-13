import { ElectronNotificationScheduler } from "../electronNotificationScheduler";

export class WindowsNotificationScheduler extends ElectronNotificationScheduler {
  constructor() {
    super("win32");
  }
}
