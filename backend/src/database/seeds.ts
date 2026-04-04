import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Repository } from 'typeorm';
import { User, UserRole } from '../modules/users/entities/user.entity';
import { Tenant } from '../modules/tenants/entities/tenant.entity';
import * as bcrypt from 'bcrypt';

/**
 * Database seeding script
 * Populates the database with initial test/demo data
 * Run with: npm run seed
 */
async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const userRepository = app.get('UserRepository') as Repository<User>;
    const tenantRepository = app.get('TenantRepository') as Repository<Tenant>;

    console.log('🌱 Starting database seeding...');

    // Create test tenants
    const tenant1 = tenantRepository.create({
      name: 'Demo Restaurant',
      slug: 'demo-restaurant',
      phone: '+1 (555) 123-4567',
      email: 'contact@demorestaurant.com',
      currency: 'RWF',
    });

    const savedTenant = await tenantRepository.save(tenant1);
    console.log('✅ Created tenant:', savedTenant.name);

    // Create test users
    const hashedPassword = await bcrypt.hash('password123', 10);

    const owner = userRepository.create({
      name: 'Owner',
      email: 'owner@example.com',
      password_hash: hashedPassword,
      role: UserRole.TENANT_OWNER,
      tenant: savedTenant,
    });

    const manager = userRepository.create({
      name: 'Manager',
      email: 'manager@example.com',
      password_hash: hashedPassword,
      role: UserRole.TENANT_MANAGER,
      tenant: savedTenant,
    });

    const kitchen = userRepository.create({
      name: 'Kitchen Staff',
      email: 'kitchen@example.com',
      password_hash: hashedPassword,
      role: UserRole.KITCHEN_STAFF,
      tenant: savedTenant,
    });

    const cashier = userRepository.create({
      name: 'Cashier',
      email: 'cashier@example.com',
      password_hash: hashedPassword,
      role: UserRole.CASHIER,
      tenant: savedTenant,
    });

    await userRepository.save([owner, manager, kitchen, cashier]);
    console.log('✅ Created 4 test users');

    console.log('🌱 Seeding complete!');
    console.log('\n📝 Test credentials:');
    console.log('   Owner:         owner@example.com / password123');
    console.log('   Manager:       manager@example.com / password123');
    console.log('   Kitchen Staff: kitchen@example.com / password123');
    console.log('   Cashier:       cashier@example.com / password123');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await app.close();
    process.exit(0);
  }
}

seed();
