import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gives every refresh token a handle its row can be found by.
 *
 * Before this, `/auth/refresh` identified a presented token by argon2-verifying
 * it against every live row of that user — so a caller who had accumulated a
 * few hundred sessions could make one unauthenticated request cost a few
 * hundred password hashes. The column is nullable because rows written before
 * it existed have no id to fill in; they simply stop matching, and their
 * holders sign in once more.
 */
export class AddRefreshTokenJti1786950000000 implements MigrationInterface {
  name = 'AddRefreshTokenJti1786950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD COLUMN "jti" uuid`);
    // Unique so a replayed id cannot be made to point at a second row; Postgres
    // allows any number of NULLs under it, which is what the legacy rows need.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_refresh_tokens_jti" ON "refresh_tokens" ("jti")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_refresh_tokens_jti"`);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN "jti"`);
  }
}
