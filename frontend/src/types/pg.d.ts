declare module 'pg' {
  export class Pool {
    constructor(config?: any);
    query(text: string, values?: any[]): Promise<any>;
    end(): Promise<void>;
  }
}
