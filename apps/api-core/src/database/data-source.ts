import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource, type DataSourceOptions } from 'typeorm';

import * as entities from './entities';

loadEnv({ path: process.env.ENV_FILE ?? '../../.env' });
loadEnv();

/** Shared by the Nest TypeOrmModule and the standalone CLI used for migrations. */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: Object.values(entities).filter((e) => typeof e === 'function') as Function[],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  migrationsRun: false,
  // Migrations are the source of truth. DB_SYNCHRONIZE is a local-bootstrap escape
  // hatch only — it must stay off anywhere the data matters.
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn', 'migration'] : ['error'],
};

export default new DataSource(dataSourceOptions);
