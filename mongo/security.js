/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Additional MongoDB Security Hardening
 * Run after initial setup
 * ═══════════════════════════════════════════════════════════════════════════════
 */

db = db.getSiblingDB('vulnerax');

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Disable server-side JavaScript execution
// ═══════════════════════════════════════════════════════════════════════════════

db.adminCommand({
    setParameter: 1,
    javascriptEnabled: false
});

print('✅ Disabled server-side JavaScript execution');

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Set up query profiling for security monitoring
// ═══════════════════════════════════════════════════════════════════════════════

db.setProfilingLevel(1, { slowms: 100 });
print('✅ Enabled query profiling for operations > 100ms');

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Create views for restricted data access
// ═══════════════════════════════════════════════════════════════════════════════

// View that excludes sensitive fields
db.createView('users_public', 'users', [
    {
        $project: {
            passwordHash: 0,  // Exclude password hash
            email: {
                $concat: [
                    { $substrCP: ['$email', 0, 2] },
                    '***@',
                    { $arrayElemAt: [{ $split: ['$email', '@'] }, 1] }
                ]
            }
        }
    }
]);

print('✅ Created users_public view (excludes sensitive data)');

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Set up custom roles for fine-grained access control
// ═══════════════════════════════════════════════════════════════════════════════

// Read-only role for analytics
db.createRole({
    role: 'analyticsReadOnly',
    privileges: [
        {
            resource: { db: 'vulnerax', collection: 'audit_logs' },
            actions: ['find']
        },
        {
            resource: { db: 'vulnerax', collection: 'users' },
            actions: ['find']
        }
    ],
    roles: []
});

print('✅ Created analyticsReadOnly role');

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Enable document validation for all operations
// ═══════════════════════════════════════════════════════════════════════════════

db.runCommand({
    collMod: 'users',
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['tenantId', 'email', 'role', 'createdAt'],
            properties: {
                tenantId: { bsonType: 'string' },
                email: {
                    bsonType: 'string',
                    pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
                },
                role: {
                    enum: ['superadmin', 'admin', 'user', 'viewer']
                },
                passwordHash: { bsonType: 'string' },
                isActive: { bsonType: 'bool' },
                createdAt: { bsonType: 'date' },
                updatedAt: { bsonType: 'date' },
                lastLoginAt: { bsonType: ['date', 'null'] }
            }
        }
    },
    validationLevel: 'strict',
    validationAction: 'error'
});

print('✅ Enforced strict document validation');

// ═══════════════════════════════════════════════════════════════════════════════
// Security Summary
// ═══════════════════════════════════════════════════════════════════════════════
print('');
print('═══════════════════════════════════════════════════════════');
print('  MongoDB Security Hardening Complete');
print('═══════════════════════════════════════════════════════════');
print('');
print('Implemented Security Measures:');
print('  ✅ Server-side JavaScript disabled');
print('  ✅ Query profiling enabled');
print('  ✅ Secure views created');
print('  ✅ Custom roles defined');
print('  ✅ Strict validation enforced');
print('');
print('⚠️  Production Recommendations:');
print('   • Enable TLS/SSL encryption');
print('   • Set up replica set for HA');
print('   • Enable audit logging (Enterprise)');
print('   • Configure backup encryption');
print('   • Set up monitoring and alerting');
print('');
