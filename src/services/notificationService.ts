export interface GameNotification {
  id: string;
  userId: string;
  type: 'progress' | 'achievement' | 'item' | 'level' | 'general';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: any;
}

export interface ProgressNotification {
  experienceGained: number;
  currencyGained: number;
  itemsFound: string[];
  skillsGained: Record<string, number>;
  offlineMinutes: number;
}

export class NotificationService {
  static createProgressNotifications(progress: ProgressNotification): GameNotification[] {
    const notifications: GameNotification[] = [];
    const timestamp = new Date();

    // Experience notification
    if (progress.experienceGained > 0) {
      notifications.push({
        id: `exp-${Date.now()}`,
        userId: '', // Will be set by caller
        type: 'progress',
        title: 'Experience Gained',
        message: `Gained ${progress.experienceGained} experience while away!`,
        timestamp,
        read: false,
        data: { experienceGained: progress.experienceGained }
      });
    }

    // Currency notification
    if (progress.currencyGained > 0) {
      notifications.push({
        id: `currency-${Date.now()}`,
        userId: '', // Will be set by caller
        type: 'progress',
        title: 'Steam Coins Earned',
        message: `Earned ${progress.currencyGained} steam coins while away!`,
        timestamp,
        read: false,
        data: { currencyGained: progress.currencyGained }
      });
    }

    // Items found notifications
    progress.itemsFound.forEach((item, index) => {
      notifications.push({
        id: `item-${Date.now()}-${index}`,
        userId: '', // Will be set by caller
        type: 'item',
        title: 'Item Found',
        message: `You found ${item} while away!`,
        timestamp,
        read: false,
        data: { itemFound: item }
      });
    });

    // Skills gained notifications
    Object.entries(progress.skillsGained).forEach(([skill, gain]) => {
      if (gain > 0) {
        notifications.push({
          id: `skill-${skill}-${Date.now()}`,
          userId: '', // Will be set by caller
          type: 'progress',
          title: 'Skill Progress',
          message: `Your ${skill} skill increased by ${gain} points!`,
          timestamp,
          read: false,
          data: { skill, skillGain: gain }
        });
      }
    });

    // General offline progress summary
    if (progress.offlineMinutes > 0) {
      const hours = Math.floor(progress.offlineMinutes / 60);
      const minutes = progress.offlineMinutes % 60;
      const timeString = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      
      notifications.push({
        id: `offline-${Date.now()}`,
        userId: '', // Will be set by caller
        type: 'general',
        title: 'Welcome Back!',
        message: `You were away for ${timeString}. Check your progress!`,
        timestamp,
        read: false,
        data: { offlineMinutes: progress.offlineMinutes }
      });
    }

    return notifications;
  }

  static formatNotificationMessage(notification: GameNotification): string {
    return `[${notification.type.toUpperCase()}] ${notification.title}: ${notification.message}`;
  }

  static getNotificationsByType(notifications: GameNotification[], type: GameNotification['type']): GameNotification[] {
    return notifications.filter(n => n.type === type);
  }

  static markAsRead(notifications: GameNotification[], notificationId: string): GameNotification[] {
    return notifications.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    );
  }

  static getUnreadCount(notifications: GameNotification[]): number {
    return notifications.filter(n => !n.read).length;
  }
}