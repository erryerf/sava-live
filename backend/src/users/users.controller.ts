import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { AdminBearerGuard } from '../common/guards/admin-bearer.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

class AdminLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

@Controller('admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: AdminLoginDto) {
    const data = await this.usersService.validateLogin(dto.email, dto.password);
    return {
      success: true,
      data,
    };
  }

  @UseGuards(AdminBearerGuard)
  @Post('users')
  async create(@Body() dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    return {
      success: true,
      data: user,
    };
  }

  @UseGuards(AdminBearerGuard)
  @Get('users')
  async findAll() {
    const users = await this.usersService.findAll();
    return {
      success: true,
      data: users,
    };
  }

  @UseGuards(AdminBearerGuard)
  @Get('users/:id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.usersService.findOne(id);
    return {
      success: true,
      data: user,
    };
  }

  @UseGuards(AdminBearerGuard)
  @Patch('users/:id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const user = await this.usersService.update(id, dto);
    return {
      success: true,
      data: user,
    };
  }

  @UseGuards(AdminBearerGuard)
  @Delete('users/:id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.remove(id);
    return {
      success: true,
      message: 'User berhasil dihapus.',
    };
  }
}

