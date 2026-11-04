declare module 'ftp-srv' {
  import { EventEmitter } from 'events';

  export interface FtpConnection extends EventEmitter {
    ip: string;
    authenticated: boolean;
    close(code?: number, message?: string): void;
  }

  export interface FtpLoginData {
    connection: FtpConnection;
    username: string;
    password?: string;
  }

  export interface FtpServerOptions {
    url?: string;
    pasv_url?: string | ((address: string) => string);
    pasv_min?: number;
    pasv_max?: number;
    greeting?: string | string[];
    anonymous?: boolean;
    blacklist?: string[];
    timeout?: number;
  }

  export class FtpSrv extends EventEmitter {
    constructor(options?: FtpServerOptions);
    listen(): Promise<void>;
    close(): Promise<void>;
  }

  export default FtpSrv;
}

