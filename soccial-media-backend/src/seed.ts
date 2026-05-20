/**
 * Script seed tao tai khoan mac dinh
 * Chay: npx ts-node src/seed.ts
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './module/user/user.entity';
import { UserRole } from './common/enum/user-role.enum';
import { UserStatus } from './common/enum/user-status.enum';

const mariadbConfig = {
  type: 'mariadb' as const,
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'zalo_app',
  entities: [User],
  synchronize: true,
};

async function seed() {
  console.log('Dang ket noi database...');

  const AppDataSource = new DataSource(mariadbConfig);
  await AppDataSource.initialize();
  console.log('Ket noi database thanh cong!');

  const userRepo = AppDataSource.getRepository(User);

  const adminEmail = 'admin@zchat.local';
  const adminPassword = 'Admin@123';
  const existingAdmin = await userRepo.findOne({ where: { email: adminEmail } as any });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const admin = userRepo.create({
      email: adminEmail,
      password: hashedPassword,
      username: 'admin',
      fullName: 'Quan tri vien',
      phone: '',
      avatarUrl: '',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });
    await userRepo.save(admin);
    console.log('Tao tai khoan ADMIN: ' + adminEmail + ' / ' + adminPassword);
  } else {
    console.log('Tai khoan Admin da ton tai');
  }

  const userEmail = 'user@zchat.local';
  const userPassword = 'User@123';
  const existingUser = await userRepo.findOne({ where: { email: userEmail } as any });

  if (!existingUser) {
    const hashedPassword = await bcrypt.hash(userPassword, 10);
    const user = userRepo.create({
      email: userEmail,
      password: hashedPassword,
      username: 'testuser',
      fullName: 'Nguoi dung Test',
      phone: '',
      avatarUrl: '',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    });
    await userRepo.save(user);
    console.log('Tao tai khoan USER: ' + userEmail + ' / ' + userPassword);
  } else {
    console.log('Tai khoan User da ton tai');
  }

  const user2Email = 'user2@zchat.local';
  const user2Password = 'User2@123';
  const existingUser2 = await userRepo.findOne({ where: { email: user2Email } as any });

  if (!existingUser2) {
    const hashedPassword = await bcrypt.hash(user2Password, 10);
    const user2 = userRepo.create({
      email: user2Email,
      password: hashedPassword,
      username: 'testuser2',
      fullName: 'Nguoi dung Test 2',
      phone: '',
      avatarUrl: '',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    });
    await userRepo.save(user2);
    console.log('Tao tai khoan USER 2: ' + user2Email + ' / ' + user2Password);
  } else {
    console.log('Tai khoan User 2 da ton tai');
  }

  console.log('Seed hoan tat!');
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Loi seed:', err);
  process.exit(1);
});
