import { ElectronNotificationScheduler } from "../electronNotificationScheduler";

export class LinuxNotificationScheduler extends ElectronNotificationScheduler {
  constructor() {
    super("linux");
  }
}
