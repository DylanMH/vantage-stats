# Database Migrations

## How It Works

The migration system automatically tracks which migrations have been run and only executes new ones on app startup. Once a migration is successfully applied, it's recorded in the `migrations` table and won't run again.

## Creating a New Migration

1. Create a new `.js` file in this directory with a descriptive name
2. Use naming convention: `YYYY-MM-DD_description.js` or similar sortable format
3. Migrations run in **alphabetical order**, so name them accordingly

### Migration Template

```javascript
// migrations/2024-11-11_add_new_feature.js

module.exports = {
  up: async (db) => {
    // Run your migration here
    // Example: Add a new column
    try {
      await db.run(`ALTER TABLE table_name ADD COLUMN new_column TEXT DEFAULT NULL`);
    } catch (err) {
      // Handle duplicate column errors gracefully
      if (!err.message.includes('duplicate column')) throw err;
    }
    
    // Example: Create a new table
    await db.run(`
      CREATE TABLE IF NOT EXISTS new_table (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      )
    `);
  },
  
  down: async (db) => {
    // Optional: Rollback logic (rarely used)
    // SQLite has limited ALTER TABLE support, so rollbacks are tricky
    console.log('⚠️  Rollback not implemented');
  }
};
```

## Best Practices

1. **Idempotent**: Make migrations safe to run multiple times (use `IF NOT EXISTS`, handle duplicate errors)
2. **Atomic**: Each migration should be a complete unit of work
3. **Tested**: Test migrations on a copy of production data before release
4. **Named**: Use clear, descriptive names for migration files
5. **Documented**: Add comments explaining what the migration does

## Checking Migration Status

The `migrations` table stores all applied migrations:

```sql
SELECT * FROM migrations ORDER BY applied_at DESC;
```

## Notes

- Migrations run automatically on app startup
- Failed migrations stop the app startup process (by design - prevents data corruption)
- SQLite has limited `ALTER TABLE` support (no DROP COLUMN, limited RENAME, etc.)
- For complex schema changes, you may need to create a new table and migrate data
