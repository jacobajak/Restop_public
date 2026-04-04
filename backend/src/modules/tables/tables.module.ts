import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Table } from './entities/table.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TablesService } from './services/tables.service';
import { QRCodeService } from './services/qrcode.service';
import { TablesController } from './controllers/tables.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Table, Tenant]), ConfigModule],
  controllers: [TablesController],
  providers: [TablesService, QRCodeService],
  exports: [TablesService, QRCodeService], // Export for other modules
})
export class TablesModule {}
