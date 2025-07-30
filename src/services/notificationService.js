"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
class NotificationService {
    static createProgressNotifications(progress) {
        const notifications = [];
        const timestamp = new Date();
        if (progress.experienceGained > 0) {
            notifications.push({
                id: `exp-${Date.now()}`,
                userId: '',
                type: 'progress',
                title: 'Experience Gained',
                message: `Gained ${progress.experienceGained} experience while away!`,
                timestamp,
                read: false,
                data: { experienceGained: progress.experienceGained }
            });
        }
        if (progress.currencyGained > 0) {
            notifications.push({
                id: `currency-${Date.now()}`,
                userId: '',
                type: 'progress',
                title: 'Steam Coins Earned',
                message: `Earned ${progress.currencyGained} steam coins while away!`,
                timestamp,
                read: false,
                data: { currencyGained: progress.currencyGained }
            });
        }
        progress.itemsFound.forEach((item, index) => {
            notifications.push({
                id: `item-${Date.now()}-${index}`,
                userId: '',
                type: 'item',
                title: 'Item Found',
                message: `You found ${item} while away!`,
                timestamp,
                read: false,
                data: { itemFound: item }
            });
        });
        Object.entries(progress.skillsGained).forEach(([skill, gain]) => {
            if (gain > 0) {
                notifications.push({
                    id: `skill-${skill}-${Date.now()}`,
                    userId: '',
                    type: 'progress',
                    title: 'Skill Progress',
                    message: `Your ${skill} skill increased by ${gain} points!`,
                    timestamp,
                    read: false,
                    data: { skill, skillGain: gain }
                });
            }
        });
        if (progress.offlineMinutes > 0) {
            const hours = Math.floor(progress.offlineMinutes / 60);
            const minutes = progress.offlineMinutes % 60;
            const timeString = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
            notifications.push({
                id: `offline-${Date.now()}`,
                userId: '',
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
    static formatNotificationMessage(notification) {
        return `[${notification.type.toUpperCase()}] ${notification.title}: ${notification.message}`;
    }
    static getNotificationsByType(notifications, type) {
        return notifications.filter(n => n.type === type);
    }
    static markAsRead(notifications, notificationId) {
        return notifications.map(n => n.id === notificationId ? { ...n, read: true } : n);
    }
    static getUnreadCount(notifications) {
        return notifications.filter(n => !n.read).length;
    }
}
exports.NotificationService = NotificationService;
