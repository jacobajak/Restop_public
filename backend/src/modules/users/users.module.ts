import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { StaffMember } from './entities/staff-member.entity';
import { StaffManagementService } from './services/staff-management.service';
import { StaffManagementController } from './controllers/staff-management.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, StaffMember])],
  controllers: [StaffManagementController],
  providers: [StaffManagementService],
  exports: [TypeOrmModule, StaffManagementService],
})
export class UsersModule {}
