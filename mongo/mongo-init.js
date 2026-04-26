/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MongoDB Initialization Script
 * Creates application user with minimal privileges and enables security features
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// Switch to the application database
db = db.getSiblingDB('vulnerax');

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Create Application User (Least Privilege Principle)
// ═══════════════════════════════════════════════════════════════════════════════

// Check if user already exists and drop it
const appUser = db.getUser(process.env.MONGO_APP_USER);
if (appUser) {
    db.dropUser(process.env.MONGO_APP_USER);
    print(`Dropped existing user: ${process.env.MONGO_APP_USER}`);
}

// Create new application user with minimal privileges
db.createUser({
    user: process.env.MONGO_APP_USER,
    pwd: process.env.MONGO_APP_PASS,
    roles: [
        {
            role: 'readWrite',
            db: 'vulnerax'
        }
    ]
});

print(`✅ Created application user: ${process.env.MONGO_APP_USER}`);

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Create Collections with Validation (Schema Enforcement)
// ═══════════════════════════════════════════════════════════════════════════════

// Users collection with validation
db.createCollection('users', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['tenantId', 'email', 'role', 'createdAt'],
            properties: {
                tenantId: {
                    bsonType: 'string',
                    description: 'Tenant ID - required for multi-tenancy'
                },
                email: {
                    bsonType: 'string',
                    pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
                    description: 'Valid email address required'
                },
                role: {
                    enum: ['superadmin', 'admin', 'user', 'viewer'],
                    description: 'Role must be one of the allowed values'
                },
                passwordHash: {
                    bsonType: 'string',
                    description: 'Bcrypt hashed password'
                },
                isActive: {
                    bsonType: 'bool',
                    description: 'Account activation status'
                },
                createdAt: {
                    bsonType: 'date',
                    description: 'Creation timestamp'
                },
                updatedAt: {
                    bsonType: 'date',
                    description: 'Last update timestamp'
                },
                lastLoginAt: {
                    bsonType: ['date', 'null'],
                    description: 'Last login timestamp'
                }
            }
        }
    },
    validationLevel: 'strict',
    validationAction: 'error'
});

print('✅ Created users collection with validation');

// Create index on tenantId + email (unique per tenant)
db.users.createIndex(
    { tenantId: 1, email: 1 },
    { unique: true, name: 'idx_tenant_email' }
);

// Create index on tenantId for fast queries
db.users.createIndex(
    { tenantId: 1 },
    { name: 'idx_tenant' }
);

print('✅ Created indexes on users collection');

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Tenants Collection
// ═══════════════════════════════════════════════════════════════════════════════

db.createCollection('tenants', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['tenantId', 'name', 'plan', 'createdAt', 'isActive'],
            properties: {
                tenantId: {
                    bsonType: 'string',
                    description: 'Unique tenant identifier (subdomain)'
                },
                name: {
                    bsonType: 'string',
                    minLength: 1,
                    maxLength: 100,
                    description: 'Tenant display name'
                },
                plan: {
                    enum: ['free', 'basic', 'pro', 'enterprise'],
                    description: 'Subscription plan'
                },
                isActive: {
                    bsonType: 'bool',
                    description: 'Whether tenant is active'
                },
                settings: {
                    bsonType: 'object',
                    description: 'Tenant-specific settings'
                },
                createdAt: {
                    bsonType: 'date'
                },
                updatedAt: {
                    bsonType: 'date'
                }
            }
        }
    },
    validationLevel: 'strict',
    validationAction: 'error'
});

// Unique index on tenantId
db.tenants.createIndex(
    { tenantId: 1 },
    { unique: true, name: 'idx_tenant_id' }
);

print('✅ Created tenants collection with validation');

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Sessions Collection (for session management)
// ═══════════════════════════════════════════════════════════════════════════════

db.createCollection('sessions', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['sessionToken', 'userId', 'tenantId', 'expires'],
            properties: {
                sessionToken: {
                    bsonType: 'string',
                    description: 'Unique session token'
                },
                userId: {
                    bsonType: 'string',
                    description: 'User ID'
                },
                tenantId: {
                    bsonType: 'string',
                    description: 'Tenant ID'
                },
                expires: {
                    bsonType: 'date',
                    description: 'Session expiration'
                }
            }
        }
    }
});

// TTL index for automatic session cleanup
db.sessions.createIndex(
    { expires: 1 },
    { expireAfterSeconds: 0, name: 'idx_session_ttl' }
);

print('✅ Created sessions collection with TTL index');

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Audit Log Collection
// ═══════════════════════════════════════════════════════════════════════════════

db.createCollection('audit_logs', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['timestamp', 'tenantId', 'action', 'userId'],
            properties: {
                timestamp: {
                    bsonType: 'date'
                },
                tenantId: {
                    bsonType: 'string'
                },
                userId: {
                    bsonType: 'string'
                },
                action: {
                    bsonType: 'string',
                    enum: ['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'ACCESS_DENIED', 'PASSWORD_CHANGE']
                },
                resource: {
                    bsonType: 'string'
                },
                details: {
                    bsonType: 'object'
                },
                ipAddress: {
                    bsonType: 'string'
                },
                userAgent: {
                    bsonType: 'string'
                }
            }
        }
    }
});

// Index for audit log queries
db.audit_logs.createIndex(
    { tenantId: 1, timestamp: -1 },
    { name: 'idx_audit_tenant_time' }
);

// TTL index for audit log retention (90 days)
db.audit_logs.createIndex(
    { timestamp: 1 },
    { expireAfterSeconds: 7776000, name: 'idx_audit_ttl' }
);

print('✅ Created audit_logs collection');

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Insert Sample Data (Optional - for development)
// ═══════════════════════════════════════════════════════════════════════════════

// Create main tenant
const mainTenantExists = db.tenants.findOne({ tenantId: 'main' });
if (!mainTenantExists) {
    db.tenants.insertOne({
        tenantId: 'main',
        name: 'Main Tenant',
        plan: 'enterprise',
        isActive: true,
        settings: {
            theme: 'default',
            features: ['ai-chat', 'voice', 'analytics']
        },
        createdAt: new Date(),
        updatedAt: new Date()
    });
    print('✅ Created main tenant');
}

print('');
print('═══════════════════════════════════════════════════════════');
print('  MongoDB Initialization Complete');
print('═══════════════════════════════════════════════════════════');
print('');
print('Security Features Enabled:');
print('  ✅ Authentication required');
print('  ✅ Schema validation on collections');
print('  ✅ Least privilege user created');
print('  ✅ TTL indexes for session cleanup');
print('  ✅ Audit logging configured');
print('');
