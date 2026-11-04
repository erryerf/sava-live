import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.usersRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email sudah terdaftar.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepository.create({
      email: dto.email.toLowerCase(),
      name: dto.name,
      passwordHash,
    });

    const saved = await this.usersRepository.save(user);
    delete (saved as Partial<User>).passwordHash;
    return saved;
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User tidak ditemukan.');
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const existing = await this.usersRepository.findOne({
        where: { email: dto.email.toLowerCase() },
      });
      if (existing) {
        throw new ConflictException('Email sudah digunakan akun lain.');
      }
      user.email = dto.email.toLowerCase();
    }

    if (dto.name !== undefined) {
      user.name = dto.name;
    }

    if (dto.password) {
      user.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const saved = await this.usersRepository.save(user);
    delete (saved as Partial<User>).passwordHash;
    return saved;
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
  }

  async validateLogin(email: string, password: string) {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Email atau password salah.');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Email atau password salah.');
    }

    const token =
      this.configService.get<string>('ADMIN_API_TOKEN') ||
      'sava-admin-secret-token-2026';

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.createdAt,
      },
    };
  }
}

