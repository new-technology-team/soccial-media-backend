/**
 * Script seed tao tai khoan mac dinh
 * Chay: npx ts-node src/seed.ts
 */
import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './module/user/user.entity';
import { UserRole } from './common/enum/user-role.enum';
import { UserStatus } from './common/enum/user-status.enum';
import { Friendship } from './module/friendship/friendship.entity';
import { FriendshipStatus } from './common/enum/friendship-status.enum';
import { Post } from './module/post/post.entity';

const mariadbConfig = () => ({
  type: 'mariadb' as const,
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'zalo_app',
  entities: [User, Friendship],
  synchronize: true,
});

const mongoConfig = () => ({
  type: 'mongodb' as const,
  url:
    process.env.DATABASE_URL_MONGO ||
    process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:27017/zalo_app',
  entities: [Post],
  synchronize: true,
});

async function seed() {
  console.log('Dang ket noi database...');

  const mariaDataSource = new DataSource(mariadbConfig());
  const mongoDataSource = new DataSource(mongoConfig());

  await mariaDataSource.initialize();
  await mongoDataSource.initialize();
  console.log('Ket noi database thanh cong!');

  const userRepo = mariaDataSource.getRepository(User);
  const friendshipRepo = mariaDataSource.getRepository(Friendship);
  const postRepo = mongoDataSource.getMongoRepository(Post);

  try {
    const adminEmail = 'admin@zchat.local';
    const adminPassword = 'Admin@123';
    const existingAdmin = await userRepo.findOne({
      where: { email: adminEmail } as any,
    });

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
    const existingUser = await userRepo.findOne({
      where: { email: userEmail } as any,
    });

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
    const existingUser2 = await userRepo.findOne({
      where: { email: user2Email } as any,
    });

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

    const admin = await userRepo.findOne({ where: { email: adminEmail } as any });
    const user1 = await userRepo.findOne({ where: { email: userEmail } as any });
    const user2 = await userRepo.findOne({ where: { email: user2Email } as any });

    const ensureAcceptedFriend = async (a: number, b: number) => {
      const existing = await friendshipRepo.findOne({
        where: [{ userId1: a, userId2: b }, { userId1: b, userId2: a }],
      });

      if (existing) {
        if (existing.status !== FriendshipStatus.ACCEPTED) {
          existing.status = FriendshipStatus.ACCEPTED;
          existing.createdAt = existing.createdAt || new Date();
          await friendshipRepo.save(existing);
        }
        return;
      }

      const friendship = friendshipRepo.create({
        userId1: Math.min(a, b),
        userId2: Math.max(a, b),
        status: FriendshipStatus.ACCEPTED,
        conversationId: '',
        createdAt: new Date(),
      });
      await friendshipRepo.save(friendship);
    };

    if (admin && user1 && user2) {
      await ensureAcceptedFriend(admin.userId, user1.userId);
      await ensureAcceptedFriend(user1.userId, user2.userId);
      console.log('Da seed quan he ban be mau cho demo');
    }

    const totalPosts = await postRepo.count();
    if (totalPosts === 0 && admin && user1 && user2) {
      const now = Date.now();
      const samples = [
        {
          owner: admin,
          content: 'Chao mung ban den voi ZChat!',
          createdAt: new Date(now - 1000 * 60 * 30),
        },
        {
          owner: user1,
          content: 'Hom nay minh vua test xong mobile app.',
          createdAt: new Date(now - 1000 * 60 * 20),
        },
        {
          owner: user2,
          content: 'Ai ranh vao tab ban be ket noi voi minh nhe.',
          createdAt: new Date(now - 1000 * 60 * 10),
        },
      ];

      for (const sample of samples) {
        const post = postRepo.create({
          title: '',
          content: sample.content,
          visibility: 'public',
          mediaUrl: '',
          createdAt: sample.createdAt,
          commentCount: 0,
          interacts: [],
          owner: {
            userId: sample.owner.userId,
            displayName: sample.owner.fullName,
            avatarUrl: sample.owner.avatarUrl || '',
          },
        });
        await postRepo.save(post);
      }
      console.log('Da seed 3 bai viet mau cho bang tin');
    } else {
      console.log('Bo qua seed bai viet (da co du lieu san)');
    }

    console.log('Seed hoan tat!');
  } finally {
    await mariaDataSource.destroy();
    await mongoDataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('Loi seed:', err);
  process.exit(1);
});
