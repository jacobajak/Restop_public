import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { NotificationTemplateService } from './services/notification-template.service';
import { NotificationHistoryService } from './services/notification-history.service';
import { NotificationEmailService } from './services/notification-email.service';
import { NotificationHistory } from './entities/notification-history.entity';
import { EmailNotificationRetryJob } from './jobs/email-notification-retry.job';
import { EmailService } from '../auth/services/email.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationHistory]),
    ScheduleModule.forRoot(),
  ],
  providers: [
    NotificationsGateway,
    NotificationsService,
    NotificationTemplateService,
    NotificationHistoryService,
    NotificationEmailService,
    EmailNotificationRetryJob,
    EmailService,
  ],
  exports: [
    NotificationsService,
    NotificationEmailService,
    NotificationHistoryService,
  ],
})
export class NotificationsModule {}
